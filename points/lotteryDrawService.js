const Lottery = require("../models/lottery");
const GuildPointsConfig = require("../models/guild-points-config");
const { getOrCreatePoints, addPoints } = require("./pointsService");
const { addToHouseBank } = require("./houseBankService");

// Cut taken from the ticket-funded part of the pot on a win (the bonus/jackpot
// portion is paid out in full, uncut - see runDraw). Rather than just
// vanishing, this cut is credited to the guild's house bank
// (points/houseBankService.js), which admins can then hand out as bonuses via
// /포인트관리 하우스지급 - so admin generosity is funded by actual collected
// house edge instead of minting points from nothing.
const HOUSE_CUT_PERCENT = 10;

// Powerball-style suspense: most weekly draws don't actually pay anyone out.
// This is the chance a winner is picked at all once a draw happens - on a
// miss, the whole pot (tickets + bonus) rolls over into next week's round
// instead of disappearing, so the jackpot visibly grows week over week.
// 35% means a jackpot hits roughly every ~3 weeks on average, which felt like
// a good balance for a small Discord server (long enough to build real
// suspense, not so long the feature feels dead).
//
// On top of that, a round that rolls over doesn't just carry the pot forward
// - the odds themselves climb too (see runDraw), same "the longer it goes,
// the more likely the next one hits" shape a real progressive jackpot has.
// Capped at 100% so it can never become an invalid/meaningless probability;
// resets to the base rate the round after a win.
const JACKPOT_BASE_HIT_CHANCE = 0.35;
const JACKPOT_HIT_CHANCE_STEP = 0.05;
const JACKPOT_HIT_CHANCE_MAX = 1;

// Default per-person ticket cap (see models/lottery.js maxTicketsPerPerson) -
// without this, one wealthy member could buy enough tickets to effectively
// lock up that week's odds. Admins can override this per-round via
// /복권 추첨 시작's 최대티켓 option.
const DEFAULT_MAX_TICKETS_PER_PERSON = 20;

// Guaranteed baseline jackpot every time a fresh cycle is `시작`'d - no command
// option for this, just a flat constant, so a brand new round always has at
// least something worth playing for even before any rollover or instant-lottery
// bleed-through has built up.
const SEED_JACKPOT = 1000;

// Fixed ticket price, no command option - same reasoning as the instant
// lottery's fixed 100-point price. 100 felt too steep relative to the 1000
// SEED_JACKPOT (10% of it per ticket discourages buying in), and 10 felt too
// cheap to meaningfully grow the pot; 50 lines up with the
// DEFAULT_MAX_TICKETS_PER_PERSON cap (20 × 50 = 1000, roughly one active
// week's easy voice/chat income spent on a full buy-in).
const DEFAULT_TICKET_PRICE = 50;

const DRAW_DAY = 6; // Saturday (Sunday = 0 ... Saturday = 6)
const DRAW_HOUR = 23;
const DRAW_MINUTE = 30;
const DRAW_TIME_ZONE = "America/New_York";

// Node's setTimeout silently misbehaves past ~24.8 days; a week is well under
// that, so this is just a safety net (kept for consistency with the other
// schedulers in this codebase).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// How long before the actual draw the heads-up announcement and the
// ticket-buyer ping go out (see scheduleWeeklyDraw / sendPreDrawAnnouncement /
// sendPreDrawReminder below).
const ANNOUNCE_BEFORE_MS = 30 * 60 * 1000;
const REMINDER_BEFORE_MS = 10 * 60 * 1000;

// In-memory only - re-armed from the DB on startup (see rearmScheduledDraws)
// so a Railway restart/redeploy doesn't lose a pending weekly draw.
const scheduledDraws = new Map(); // guildId -> Timeout
const scheduledAnnouncements = new Map(); // guildId -> Timeout
const scheduledReminders = new Map(); // guildId -> Timeout

// Reads a Date's wall-clock date/time as seen in a given IANA time zone,
// without needing a date library - Intl.DateTimeFormat already knows the
// zone's UTC offset (including DST) for any given moment.
function getPartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    // hour12:false can format midnight as "24" in some environments.
    hour: map.hour === "24" ? 0 : parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    weekday: weekdayIndex,
  };
}

// Computes the next Saturday 11:30 PM in America/New_York (handles EST/EDT
// automatically), always at least a moment in the future - if called exactly
// at this week's slot it rolls to next week rather than returning "now".
function getNextSaturdayNightET(from = new Date()) {
  const nowInET = getPartsInTimeZone(from, DRAW_TIME_ZONE);

  let daysUntilTarget = (DRAW_DAY - nowInET.weekday + 7) % 7;
  const alreadyPastSlotToday =
    daysUntilTarget === 0 &&
    (nowInET.hour > DRAW_HOUR || (nowInET.hour === DRAW_HOUR && nowInET.minute >= DRAW_MINUTE));
  if (alreadyPastSlotToday) daysUntilTarget = 7;

  // Build the intended wall-clock target, then correct for the ET UTC offset
  // by seeing how a UTC-labeled guess actually reads back in ET and adjusting
  // by the difference - this is the standard trick for timezone-correct date
  // math without an extra library.
  const intendedUTC = Date.UTC(nowInET.year, nowInET.month - 1, nowInET.day + daysUntilTarget, DRAW_HOUR, DRAW_MINUTE, 0);
  const guess = new Date(intendedUTC);
  const shown = getPartsInTimeZone(guess, DRAW_TIME_ZONE);
  const shownAsUTC = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0);
  const offsetMs = intendedUTC - shownAsUTC;

  return new Date(guess.getTime() + offsetMs);
}

function totalTickets(lottery) {
  return lottery.tickets.reduce((sum, t) => sum + t.count, 0);
}

// Ticket money + any bonusPot fed in from instant-lottery losses or a
// previous week's rollover.
function totalPot(lottery) {
  return totalTickets(lottery) * lottery.ticketPrice + (lottery.bonusPot || 0);
}

// Pulls whatever jackpot built up in the per-guild bank (instant-lottery
// contributions that arrived while no round was OPEN) and clears it - used
// both for the very first round and for each automatically-opened next round.
async function sweepBankedJackpot(guildId) {
  const config = await GuildPointsConfig.findOneAndUpdate({ guildId }, { lotteryJackpotBank: 0 }, { upsert: true, new: false });
  return config?.lotteryJackpotBank || 0;
}

async function startLottery(guildId, userId, ticketPrice, maxTicketsPerPerson = DEFAULT_MAX_TICKETS_PER_PERSON, announceChannelId) {
  const existing = await Lottery.findOne({ guildId, status: "OPEN" });
  if (existing) throw new Error("이미 진행중인 추첨 라운드가 있습니다.");

  // A brand new cycle otherwise starts at 0 unless a rollover or instant-lottery
  // bleed-through has already banked something, which can make the very first
  // week feel underwhelming - SEED_JACKPOT guarantees every fresh `시작` has at
  // least a baseline pot worth playing for, on top of whatever's banked.
  const bonusPot = SEED_JACKPOT + (await sweepBankedJackpot(guildId));
  const drawAt = getNextSaturdayNightET();

  return Lottery.create({
    guildId,
    ticketPrice,
    maxTicketsPerPerson,
    createdBy: userId,
    bonusPot,
    jackpotHitChance: JACKPOT_BASE_HIT_CHANCE,
    drawAt,
    announceChannelId,
  });
}

// Admin-only "turn the whole recurring cycle off". Refunds any tickets bought
// this round (unlike a normal no-winner rollover, this isn't a draw outcome -
// the admin is choosing to stop before one happened) and does NOT open a next
// round or reschedule anything.
async function stopLottery(guildId) {
  const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
  if (!lottery) throw new Error("진행중인 추첨 라운드가 없습니다.");

  clearAllScheduledTimers(guildId);

  for (const entry of lottery.tickets) {
    await addPoints(guildId, { id: entry.userId, username: entry.username }, entry.count * lottery.ticketPrice);
  }

  // Any bonus pot (jackpot) is banked rather than lost, so turning the feature
  // back on later doesn't feel like it erased people's contributions.
  if (lottery.bonusPot > 0) {
    await GuildPointsConfig.findOneAndUpdate({ guildId }, { $inc: { lotteryJackpotBank: lottery.bonusPot } }, { upsert: true });
  }

  lottery.status = "CANCELLED";
  lottery.resolvedAt = new Date();
  await lottery.save();
  return lottery;
}

async function buyTickets(guildId, user, count) {
  const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
  if (!lottery) throw new Error("진행중인 추첨 라운드가 없습니다.");

  const existingEntry = lottery.tickets.find((t) => t.userId === user.id);
  const maxPerPerson = lottery.maxTicketsPerPerson || DEFAULT_MAX_TICKETS_PER_PERSON;
  const currentCount = existingEntry?.count || 0;
  if (currentCount + count > maxPerPerson) {
    const remaining = Math.max(maxPerPerson - currentCount, 0);
    throw new Error(
      `1인당 최대 ${maxPerPerson}장까지만 살 수 있어요. (지금까지 ${currentCount}장 구매, 최대 ${remaining}장 더 살 수 있어요)`
    );
  }

  const cost = lottery.ticketPrice * count;
  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < cost) {
    throw new Error(`포인트가 부족해요. (티켓 ${count}장 = ${cost.toLocaleString()} 포인트, 현재 ${balance.points.toLocaleString()} 포인트)`);
  }

  await addPoints(guildId, user, -cost);

  if (existingEntry) {
    existingEntry.count += count;
    existingEntry.username = user.username ?? existingEntry.username;
  } else {
    lottery.tickets.push({ userId: user.id, username: user.username, count });
  }
  await lottery.save();

  return lottery;
}

// Repoints the currently OPEN round's announcement channel without
// restarting the cycle (a plain `종료` + `시작` would refund every ticket
// bought so far and reset the jackpot chain, which is way more disruptive
// than just fixing where the notices go). Re-arms the timers immediately so
// any already-scheduled announce/reminder/result timers pick up the change.
async function setAnnounceChannel(guildId, channelId, client) {
  const lottery = await Lottery.findOneAndUpdate(
    { guildId, status: "OPEN" },
    { announceChannelId: channelId },
    { returnDocument: "after" }
  );
  if (!lottery) throw new Error("진행중인 추첨 라운드가 없습니다.");

  if (client) scheduleWeeklyDraw(client, lottery);
  return lottery;
}

function clearScheduledDraw(guildId) {
  const timer = scheduledDraws.get(guildId);
  if (timer) {
    clearTimeout(timer);
    scheduledDraws.delete(guildId);
  }
}

function clearScheduledAnnouncement(guildId) {
  const timer = scheduledAnnouncements.get(guildId);
  if (timer) {
    clearTimeout(timer);
    scheduledAnnouncements.delete(guildId);
  }
}

function clearScheduledReminder(guildId) {
  const timer = scheduledReminders.get(guildId);
  if (timer) {
    clearTimeout(timer);
    scheduledReminders.delete(guildId);
  }
}

function clearAllScheduledTimers(guildId) {
  clearScheduledDraw(guildId);
  clearScheduledAnnouncement(guildId);
  clearScheduledReminder(guildId);
}

// Heads-up post 30 minutes before the draw - "it's happening tonight, buy in
// if you haven't". No-ops quietly if the round has no announceChannelId set
// (older rounds created before this feature existed) or the channel's gone.
async function sendPreDrawAnnouncement(guildId, client) {
  try {
    const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
    if (!lottery || !lottery.announceChannelId || !lottery.drawAt) return;

    const channel = await client.channels.fetch(lottery.announceChannelId).catch(() => null);
    if (!channel) return;

    await channel.send(
      `⏰ 오늘 밤 <t:${Math.floor(lottery.drawAt.getTime() / 1000)}:t>에 추첨 복권이 진행됩니다! ` +
        `현재 판돈 ${totalPot(lottery).toLocaleString()} 포인트, 판매된 티켓 ${totalTickets(lottery)}장. ` +
        "아직 안 사셨다면 `/복권 추첨 구매`로 참여하세요!"
    );
  } catch (err) {
    console.error(`[lottery] pre-draw announcement failed for guild ${guildId}:`, err.message);
  }
}

// Ping everyone who bought a ticket this round, 10 minutes before the draw.
async function sendPreDrawReminder(guildId, client) {
  try {
    const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
    if (!lottery || !lottery.announceChannelId || !lottery.drawAt) return;
    if (lottery.tickets.length === 0) return;

    const channel = await client.channels.fetch(lottery.announceChannelId).catch(() => null);
    if (!channel) return;

    const mentions = lottery.tickets.map((t) => `<@${t.userId}>`).join(" ");
    await channel.send(`🎟️ 10분 뒤 <t:${Math.floor(lottery.drawAt.getTime() / 1000)}:t>에 추첨이 진행됩니다! 행운을 빕니다 ${mentions}`);
  } catch (err) {
    console.error(`[lottery] pre-draw reminder failed for guild ${guildId}:`, err.message);
  }
}

// Shared with the manual `/복권 추첨 뽑기` command handler (commands/points/lottery.js)
// so the automatic weekly draw and a manually-forced one always read the same.
function formatDrawResultMessage(result) {
  if (result.outcome === "no_tickets") {
    return `아무도 티켓을 사지 않아서 이번 회차는 취소되었고, 잭팟 ${result.pot.toLocaleString()} 포인트는 다음 라운드로 이월됩니다.`;
  }
  if (result.outcome === "rollover") {
    return `😮 이번엔 당첨자가 나오지 않았어요! 판돈 ${result.pot.toLocaleString()} 포인트는 전부 다음 라운드로 이월되고, 다음 주 당첨 확률은 ${Math.round(result.nextHitChance * 100)}%로 올라갑니다.`;
  }
  return `🎉 <@${result.winnerId}> 님이 당첨되었습니다! 판돈 ${result.pot.toLocaleString()} 포인트 중 ${result.payout.toLocaleString()} 포인트를 받았습니다. (티켓 ${result.ticketsSold}장 판매)`;
}

function scheduleWeeklyDraw(client, lottery) {
  if (!lottery.drawAt) return;

  const guildId = lottery.guildId;
  clearAllScheduledTimers(guildId);

  const drawTime = lottery.drawAt.getTime();
  // Captured here (not re-read from the DB in the timer callback) so the
  // result gets posted to the channel this specific round was configured
  // for, even if a later round changes it.
  const announceChannelId = lottery.announceChannelId;

  const drawDelay = Math.min(Math.max(drawTime - Date.now(), 0), MAX_TIMEOUT_MS);
  const drawTimer = setTimeout(() => {
    scheduledDraws.delete(guildId);
    runDraw(guildId, client)
      .then(async (result) => {
        // The manual `/복권 추첨 뽑기` command posts its own reply - this is only
        // for draws that fire on their own from the weekly timer, which
        // previously announced nothing anywhere once resolved.
        if (!announceChannelId) return;
        const channel = await client.channels.fetch(announceChannelId).catch(() => null);
        if (!channel) return;
        await channel.send(formatDrawResultMessage(result)).catch((err) => console.error(`[lottery] result announcement failed:`, err.message));
      })
      .catch((err) => console.error(`[lottery] scheduled draw failed for guild ${guildId}:`, err.message));
  }, drawDelay);
  scheduledDraws.set(guildId, drawTimer);

  // Unlike the draw itself, these two are skipped entirely (not fired late) if
  // a restart lands after their moment has already passed - a "10 minutes
  // left!" ping sent 2 minutes before the draw would be more confusing than
  // just not sending it.
  const announceDelay = drawTime - ANNOUNCE_BEFORE_MS - Date.now();
  if (announceDelay > 0 && announceDelay <= MAX_TIMEOUT_MS) {
    const announceTimer = setTimeout(() => {
      scheduledAnnouncements.delete(guildId);
      sendPreDrawAnnouncement(guildId, client);
    }, announceDelay);
    scheduledAnnouncements.set(guildId, announceTimer);
  }

  const reminderDelay = drawTime - REMINDER_BEFORE_MS - Date.now();
  if (reminderDelay > 0 && reminderDelay <= MAX_TIMEOUT_MS) {
    const reminderTimer = setTimeout(() => {
      scheduledReminders.delete(guildId);
      sendPreDrawReminder(guildId, client);
    }, reminderDelay);
    scheduledReminders.set(guildId, reminderTimer);
  }
}

// Runs after every draw (win, rollover, or the zero-ticket edge case) to keep
// the weekly cycle going automatically - only stopLottery breaks the chain.
async function openNextRound(guildId, ticketPrice, maxTicketsPerPerson, carryOverBonus, jackpotHitChance, client, announceChannelId) {
  const bankedBonus = await sweepBankedJackpot(guildId);
  const drawAt = getNextSaturdayNightET();

  const next = await Lottery.create({
    guildId,
    ticketPrice,
    maxTicketsPerPerson,
    createdBy: "system", // auto-opened, not admin-triggered
    bonusPot: carryOverBonus + bankedBonus,
    jackpotHitChance,
    drawAt,
    announceChannelId,
  });

  if (client) scheduleWeeklyDraw(client, next);
  return next;
}

// Core draw logic, shared by the automatic weekly timer AND a manual admin
// `/복권 추첨 뽑기` (deliberately the same code path so admins can't bypass the
// odds - a manual draw is still subject to the round's own jackpotHitChance
// and can still roll over). Always opens the next round afterward except
// when there simply were no tickets at all - client is optional (used to
// (re)schedule the next round's timer; omit only from contexts that don't
// have a client handy, in which case rearmScheduledDraws will pick it up on
// the next boot).
async function runDraw(guildId, client) {
  const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
  if (!lottery) throw new Error("진행중인 추첨 라운드가 없습니다.");

  clearAllScheduledTimers(guildId);
  const tickets = totalTickets(lottery);
  const maxTicketsPerPerson = lottery.maxTicketsPerPerson || DEFAULT_MAX_TICKETS_PER_PERSON;
  // Rounds created before this field existed fall back to the base rate.
  const hitChance = lottery.jackpotHitChance ?? JACKPOT_BASE_HIT_CHANCE;

  if (tickets === 0) {
    // Nobody played - no draw actually happened, so the odds aren't touched
    // either way (only carry the bonus pot forward and try again next week).
    lottery.status = "CANCELLED";
    lottery.resolvedAt = new Date();
    await lottery.save();
    await openNextRound(guildId, lottery.ticketPrice, maxTicketsPerPerson, lottery.bonusPot || 0, hitChance, client, lottery.announceChannelId);
    return { outcome: "no_tickets", pot: lottery.bonusPot || 0 };
  }

  const jackpotHit = Math.random() < hitChance;
  const ticketPot = tickets * lottery.ticketPrice;
  const bonusPot = lottery.bonusPot || 0;
  const pot = ticketPot + bonusPot;

  if (!jackpotHit) {
    // Powerball-style miss: everyone's tickets are still spent (that's the
    // cost of playing that week), but the whole pot rolls into next week
    // instead of disappearing - this is what makes the jackpot grow. The
    // odds themselves also climb a step for next week, on top of that.
    const nextHitChance = Math.min(hitChance + JACKPOT_HIT_CHANCE_STEP, JACKPOT_HIT_CHANCE_MAX);
    lottery.status = "ROLLOVER";
    lottery.resolvedAt = new Date();
    await lottery.save();
    await openNextRound(guildId, lottery.ticketPrice, maxTicketsPerPerson, pot, nextHitChance, client, lottery.announceChannelId);
    return { outcome: "rollover", pot, ticketsSold: tickets, nextHitChance };
  }

  let roll = Math.floor(Math.random() * tickets);
  let winner = null;
  for (const entry of lottery.tickets) {
    if (roll < entry.count) {
      winner = entry;
      break;
    }
    roll -= entry.count;
  }

  // Compute the ticket-holder's share first, then take the house cut as
  // whatever's left over (rather than rounding both independently) so the two
  // numbers always add back up to exactly ticketPot with no leftover/missing
  // point from double-rounding.
  const ticketPortion = Math.round(ticketPot * (1 - HOUSE_CUT_PERCENT / 100));
  const houseCut = ticketPot - ticketPortion;
  const payout = ticketPortion + bonusPot;

  await addPoints(guildId, { id: winner.userId, username: winner.username }, payout);
  await addToHouseBank(guildId, houseCut);

  lottery.status = "DRAWN";
  lottery.winnerId = winner.userId;
  lottery.winnerPayout = payout;
  lottery.resolvedAt = new Date();
  await lottery.save();

  // Unlike a rollover (which carries the whole pot forward, seed included), a
  // win pays the pot out and the next round starts from scratch - so it gets
  // its own fresh SEED_JACKPOT baseline and the odds reset to the base rate,
  // same as a brand new `/복권 추첨 시작`.
  await openNextRound(guildId, lottery.ticketPrice, maxTicketsPerPerson, SEED_JACKPOT, JACKPOT_BASE_HIT_CHANCE, client, lottery.announceChannelId);

  return { outcome: "win", winnerId: winner.userId, payout, pot, ticketsSold: tickets };
}

// Run once after the bot logs in (and mongo is connected) so a guild with a
// pending weekly draw gets its timer re-armed - including drawing immediately
// if the scheduled time already passed while the bot was down.
async function rearmScheduledDraws(client) {
  try {
    const pending = await Lottery.find({ status: "OPEN", drawAt: { $ne: null } });
    for (const lottery of pending) {
      scheduleWeeklyDraw(client, lottery);
    }
    if (pending.length > 0) {
      console.log(`[lottery] re-armed ${pending.length} pending weekly draw(s)`);
    }
  } catch (err) {
    console.error("[lottery] failed to re-arm scheduled draws:", err.message);
  }
}

// Called from the instant lottery (commands/lottery.js '긁기') whenever
// someone loses ("꽝") - routes a cut of the lost bet into whichever draw-style
// round is currently OPEN for this guild (visible immediately in
// `/복권 추첨 확인`), or into the per-guild bank if no round is open right now
// (swept into bonusPot automatically the next time one opens).
async function addJackpotContribution(guildId, amount) {
  if (amount <= 0) return;

  const openLottery = await Lottery.findOne({ guildId, status: "OPEN" });
  if (openLottery) {
    openLottery.bonusPot = (openLottery.bonusPot || 0) + amount;
    await openLottery.save();
    return;
  }

  await GuildPointsConfig.findOneAndUpdate({ guildId }, { $inc: { lotteryJackpotBank: amount } }, { upsert: true });
}

module.exports = {
  startLottery,
  stopLottery,
  buyTickets,
  setAnnounceChannel,
  runDraw,
  scheduleWeeklyDraw,
  clearScheduledDraw,
  rearmScheduledDraws,
  addJackpotContribution,
  formatDrawResultMessage,
  getNextSaturdayNightET,
  totalTickets,
  totalPot,
  HOUSE_CUT_PERCENT,
  JACKPOT_BASE_HIT_CHANCE,
  JACKPOT_HIT_CHANCE_STEP,
  JACKPOT_HIT_CHANCE_MAX,
  DEFAULT_MAX_TICKETS_PER_PERSON,
  SEED_JACKPOT,
  DEFAULT_TICKET_PRICE,
};
