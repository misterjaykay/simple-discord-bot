const { EmbedBuilder } = require("discord.js");
const Pet = require("../models/pet");
const PetTournament = require("../models/pet-tournament");
const GuildPointsConfig = require("../models/guild-points-config");
const { getOrCreatePoints, addPoints } = require("../points/pointsService");
const { addToHouseBank } = require("../points/houseBankService");
const { sweepPetTournamentBonusBank, getPetTournamentBonusBank } = require("../points/petTournamentBonusBankService");
const { getPet } = require("./petService");
const { ensureBattleStats, resolveMatch } = require("./battleService");

// Points economy note: mirrors the draw-style lottery (points/lotteryDrawService.js)
// as closely as possible - same weekly-recurring-cycle shape, same house-cut-
// into-houseBank pattern, same setTimeout+rearm scheduling approach. The
// server-funded top-up used to be a flat BONUS_PER_PARTICIPANT - replaced by
// sweeping petTournamentBonusBank (half of every /펫밥주기·/펫놀아주기 cost,
// see petService.routeActionCost) into the pot at settlement instead.
const ENTRY_FEE = 250;
const MIN_PARTICIPANTS = 4; // below this, the week is skipped and refunded
const HOUSE_CUT_PERCENT = 10;
const WINNER_SHARE = 0.6; // the rest goes to the runner-up (see runTournament's remainder-based split)

const RUN_DAY = 5; // Friday (Sunday = 0 ... Saturday = 6) - a day before the lottery's Saturday draw
const RUN_HOUR = 23;
const RUN_MINUTE = 30;
const REGISTRATION_CLOSE_HOUR = 21;
const REGISTRATION_CLOSE_MINUTE = 0;
const TIME_ZONE = "America/New_York";

// Node's setTimeout silently misbehaves past ~24.8 days; a week is well under
// that, so this is just a safety net (kept for consistency with the other
// schedulers in this codebase).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// In-memory only - re-armed from the DB on startup (see rearmScheduledTournaments)
// so a Railway restart/redeploy doesn't lose a pending weekly run.
const scheduledTournaments = new Map(); // guildId -> Timeout

// Reads a Date's wall-clock date/time as seen in a given IANA time zone,
// without needing a date library - same trick as lotteryDrawService.js.
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
    hour: map.hour === "24" ? 0 : parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    weekday: weekdayIndex,
  };
}

function buildTimeOnDay(nowInET, daysUntilTarget, hour, minute) {
  const intendedUTC = Date.UTC(nowInET.year, nowInET.month - 1, nowInET.day + daysUntilTarget, hour, minute, 0);
  const guess = new Date(intendedUTC);
  const shown = getPartsInTimeZone(guess, TIME_ZONE);
  const shownAsUTC = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0);
  const offsetMs = intendedUTC - shownAsUTC;
  return new Date(guess.getTime() + offsetMs);
}

// Computes the next Friday's run time (11:30 PM ET) and that same Friday's
// registration-close time (9:00 PM ET) - always at least a moment in the
// future relative to the run time, mirroring getNextSaturdayNightET.
function getNextTournamentTimes(from = new Date()) {
  const nowInET = getPartsInTimeZone(from, TIME_ZONE);

  let daysUntilFriday = (RUN_DAY - nowInET.weekday + 7) % 7;
  const alreadyPastRunSlotToday =
    daysUntilFriday === 0 && (nowInET.hour > RUN_HOUR || (nowInET.hour === RUN_HOUR && nowInET.minute >= RUN_MINUTE));
  if (alreadyPastRunSlotToday) daysUntilFriday = 7;

  const runAt = buildTimeOnDay(nowInET, daysUntilFriday, RUN_HOUR, RUN_MINUTE);
  const registrationCloseAt = buildTimeOnDay(nowInET, daysUntilFriday, REGISTRATION_CLOSE_HOUR, REGISTRATION_CLOSE_MINUTE);
  return { runAt, registrationCloseAt };
}

async function startWeeklyTournament(guildId, userId) {
  const existing = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  if (existing) throw new Error("이미 진행중인 펫 토너먼트 주기가 있습니다.");

  const { runAt, registrationCloseAt } = getNextTournamentTimes();
  return PetTournament.create({ guildId, createdBy: userId, runAt, registrationCloseAt });
}

async function stopWeeklyTournament(guildId) {
  const tournament = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  if (!tournament) throw new Error("진행중인 펫 토너먼트가 없습니다.");

  clearScheduledTournament(guildId);

  for (const p of tournament.participants) {
    await addPoints(guildId, { id: p.userId, username: p.username }, ENTRY_FEE);
  }

  tournament.status = "CANCELLED";
  tournament.resolvedAt = new Date();
  await tournament.save();
  return tournament;
}

async function registerParticipant(guildId, user, slot) {
  const pet = await getPet(guildId, user.id, slot);
  if (!pet) throw new Error("그 슬롯엔 펫이 없어요. `/펫정보`로 슬롯을 확인해주세요.");

  const tournament = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  if (!tournament) throw new Error("진행중인 펫 토너먼트가 없어요. 관리자에게 `/펫대전 시작`을 요청해주세요.");

  if (Date.now() > tournament.registrationCloseAt.getTime()) {
    throw new Error("이번 주 신청은 마감됐어요. 다음 주 신청 기간(토~목)에 다시 시도해주세요.");
  }

  // One entry per pet slot, not per user - an owner can register every pet
  // they have (up to their unlocked slot count) by calling this once per slot.
  if (tournament.participants.some((p) => p.userId === user.id && p.slot === slot)) {
    throw new Error("이미 그 슬롯의 펫으로 이번 주 토너먼트에 신청하셨어요.");
  }

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < ENTRY_FEE) {
    throw new Error(`참가비가 부족해요. (참가비 ${ENTRY_FEE.toLocaleString()} 포인트, 현재 ${balance.points.toLocaleString()} 포인트)`);
  }

  await addPoints(guildId, user, -ENTRY_FEE);
  tournament.participants.push({ userId: user.id, username: user.username, petId: pet._id, slot });
  await tournament.save();
  return { tournament, pet };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Round 1 only: pads the field up to the next power of 2 with random byes
// (auto-advancing, no match played) so every later round is a clean pairwise
// bracket with no further byes needed. Entrants carry a per-pet entrantId
// (not just userId) since one owner can now have multiple pets in the field.
function buildRound1Matches(entrants) {
  const shuffled = shuffle(entrants);
  const n = shuffled.length;
  let size = 1;
  while (size < n) size *= 2;
  const byesNeeded = size - n;

  const byeRecipients = shuffled.slice(0, byesNeeded);
  const paired = shuffled.slice(byesNeeded);

  const matches = byeRecipients.map((entrant) => ({ player1: entrant, isBye: true }));
  for (let i = 0; i < paired.length; i += 2) {
    matches.push({ player1: paired[i], player2: paired[i + 1], isBye: false });
  }
  return matches;
}

// Round 2+: entrants.length is always an exact power of 2 by construction, so
// this is just a straightforward pairwise split - no byes possible here.
function pairEntrants(entrants) {
  const matches = [];
  for (let i = 0; i < entrants.length; i += 2) {
    matches.push({ player1: entrants[i], player2: entrants[i + 1], isBye: false });
  }
  return matches;
}

function clearScheduledTournament(guildId) {
  const timer = scheduledTournaments.get(guildId);
  if (timer) {
    clearTimeout(timer);
    scheduledTournaments.delete(guildId);
  }
}

// petNameByPetId: petId string -> pet nickname/species label, so the bracket
// reads "@민수(파이리)" instead of just "@민수" - mentions inside an embed
// render as clickable tags but don't actually notify anyone (unlike message
// content mentions), and allowedMentions:{parse:[]} on the send call (see
// announceResult) guarantees that regardless. Keyed by petId rather than
// userId since one owner can now have multiple pets in the bracket at once.
// One ✅/❌ per roll this side played, in order - for a normal (single-roll)
// match that's just one symbol, and for the best-of-3 final it reads as a
// sequence like "✅❌✅" instead of a bare "2:1" score. ✅ (not a plain circle)
// specifically because it renders green in every Discord client, so a win
// reads as green / a loss reads as red at a glance with no custom styling.
function rollSequence(rounds, side) {
  return rounds.map((roundWinnerSide) => (roundWinnerSide === side ? "✅" : "❌")).join("");
}

function formatBracketMessage(tournament, petNameByPetId) {
  const label = (userId, petId) => {
    const petName = petId ? petNameByPetId.get(String(petId)) : null;
    return petName ? `<@${userId}>(${petName})` : `<@${userId}>`;
  };

  const lines = [];
  for (const roundEntry of tournament.bracket) {
    lines.push(`**${roundEntry.round}라운드**`);
    for (const m of roundEntry.matches) {
      if (m.isBye) {
        lines.push(`　🎫 부전승: ${label(m.player1UserId, m.player1PetId)}`);
      } else {
        const p1Mark = rollSequence(m.rounds, "A");
        const p2Mark = rollSequence(m.rounds, "B");
        // Marks sit together in the middle, flanking "vs" - reads as
        // "player ❌ vs ✅ player" instead of each mark trailing its own name.
        lines.push(
          `　${label(m.player1UserId, m.player1PetId)} ${p1Mark} vs ${p2Mark} ${label(m.player2UserId, m.player2PetId)}`
        );
      }
    }
  }
  return lines.join("\n");
}

async function getAnnounceChannel(guildId, client) {
  const config = await GuildPointsConfig.findOne({ guildId });
  if (!config?.petTournamentChannelId) return null;
  return client.channels.fetch(config.petTournamentChannelId).catch(() => null);
}

async function announceSkip(guildId, client, participantCount) {
  try {
    const channel = await getAnnounceChannel(guildId, client);
    if (!channel) return;
    await channel.send(
      `😅 이번 주 펫 토너먼트는 참가 펫이 ${participantCount}마리뿐이라(최소 ${MIN_PARTICIPANTS}마리 필요) 취소됐어요. 참가비는 전액 환불됐습니다.`
    );
  } catch (err) {
    console.error("[pet-tournament] skip announcement failed:", err.message);
  }
}

async function announceResult(guildId, client, tournament, petNameByPetId) {
  try {
    const channel = await getAnnounceChannel(guildId, client);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("🏆 이번 주 펫 토너먼트 결과")
      .setDescription(formatBracketMessage(tournament, petNameByPetId))
      .addFields(
        {
          name: "우승",
          value: `<@${tournament.winnerId}>(${tournament.winnerPetName}) - ${tournament.winnerPayout.toLocaleString()} 포인트`,
          inline: true,
        },
        {
          name: "준우승",
          value: `<@${tournament.runnerUpId}>(${tournament.runnerUpPetName}) - ${tournament.runnerUpPayout.toLocaleString()} 포인트`,
          inline: true,
        }
      )
      .setColor(0xffcb05);

    // parse:[] belt-and-suspenders on top of embed mentions already not
    // pinging - nobody in the bracket gets notified just for being shown.
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error("[pet-tournament] result announcement failed:", err.message);
  }
}

async function openNextCycle(guildId, client) {
  const { runAt, registrationCloseAt } = getNextTournamentTimes();
  const next = await PetTournament.create({ guildId, createdBy: "system", runAt, registrationCloseAt });
  if (client) scheduleWeeklyTournament(client, next);
  return next;
}

function scheduleWeeklyTournament(client, tournament) {
  if (!tournament.runAt) return;

  const guildId = tournament.guildId;
  clearScheduledTournament(guildId);

  const runDelay = Math.min(Math.max(tournament.runAt.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
  const timer = setTimeout(() => {
    scheduledTournaments.delete(guildId);
    runTournament(guildId, client).catch((err) => console.error(`[pet-tournament] scheduled run failed for guild ${guildId}:`, err.message));
  }, runDelay);
  scheduledTournaments.set(guildId, timer);
}

// Core weekly run: builds the bracket, resolves every match, pays out, and
// always opens next week's registration cycle afterward (skip-for-low-turnout
// included) - only stopWeeklyTournament breaks the chain.
async function runTournament(guildId, client) {
  const tournament = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  if (!tournament) return;

  clearScheduledTournament(guildId);

  // One entrant per registered pet (not per user) - entrantId is the pet's
  // own _id so two pets owned by the same user stay distinct throughout the
  // bracket. petId pins the exact pet chosen at registration (see
  // registerParticipant) so battles use that pet even if the owner touches
  // other slots later. Falls back to slot lookup for participant records
  // from before petId existed (a tournament mid-cycle when that shipped).
  const entrants = [];
  for (const p of tournament.participants) {
    const pet = p.petId ? await Pet.findById(p.petId) : await getPet(guildId, p.userId, p.slot ?? 1);
    // Participants who released their pet after registering (rare) can't
    // battle - skipped here, which excludes them from the bracket while
    // still being covered by whatever refund/skip handling below applies.
    if (!pet) continue;
    const entrantId = p.petId ? String(p.petId) : `${p.userId}:${p.slot ?? 1}`;
    entrants.push({ entrantId, userId: p.userId, username: p.username, pet });
  }
  const entrantById = new Map(entrants.map((e) => [e.entrantId, e]));
  // Always the species name (파이리), never a user-given nickname (귀염이) -
  // the bracket is meant to read as "유저(종)", not show off custom names.
  const petNameByPetId = new Map(entrants.map((e) => [String(e.pet._id), e.pet.speciesName]));

  if (entrants.length < MIN_PARTICIPANTS) {
    for (const p of tournament.participants) {
      await addPoints(guildId, { id: p.userId, username: p.username }, ENTRY_FEE);
    }
    tournament.status = "CANCELLED";
    tournament.resolvedAt = new Date();
    await tournament.save();

    await announceSkip(guildId, client, entrants.length);
    await openNextCycle(guildId, client);
    return;
  }

  for (const e of entrants) {
    await ensureBattleStats(e.pet);
  }

  const bracket = [];
  let currentEntrants = entrants.map((e) => ({ entrantId: e.entrantId, userId: e.userId, username: e.username }));
  let round = 1;
  let finalLoserEntrant = null;

  while (currentEntrants.length > 1) {
    const isFinalRound = currentEntrants.length === 2;
    const matchDefs = round === 1 ? buildRound1Matches(currentEntrants) : pairEntrants(currentEntrants);

    const resolvedMatches = [];
    const winners = [];

    for (const m of matchDefs) {
      const p1 = entrantById.get(m.player1.entrantId);
      if (m.isBye) {
        resolvedMatches.push({
          player1UserId: p1.userId,
          player1PetId: p1.pet._id,
          winnerUserId: p1.userId,
          winnerPetId: p1.pet._id,
          isBye: true,
        });
        winners.push(m.player1);
        continue;
      }

      const p2 = entrantById.get(m.player2.entrantId);
      const { winnerSide, rounds: rollResults } = await resolveMatch(p1.pet, p2.pet, isFinalRound);
      const winnerEntrant = winnerSide === "A" ? m.player1 : m.player2;
      const loserEntrant = winnerSide === "A" ? m.player2 : m.player1;
      const winnerPetDoc = entrantById.get(winnerEntrant.entrantId).pet;

      resolvedMatches.push({
        player1UserId: p1.userId,
        player2UserId: p2.userId,
        player1PetId: p1.pet._id,
        player2PetId: p2.pet._id,
        winnerUserId: winnerEntrant.userId,
        winnerPetId: winnerPetDoc._id,
        isBye: false,
        rounds: rollResults,
      });
      winners.push(winnerEntrant);

      if (isFinalRound) finalLoserEntrant = loserEntrant;
    }

    bracket.push({ round, matches: resolvedMatches });
    currentEntrants = winners;
    round += 1;
  }

  const winnerEntrant = currentEntrants[0];
  const winnerPet = entrantById.get(winnerEntrant.entrantId).pet;
  const runnerUpPet = entrantById.get(finalLoserEntrant.entrantId).pet;

  const bonusFromBank = await sweepPetTournamentBonusBank(guildId);
  const pot = entrants.length * ENTRY_FEE + bonusFromBank;
  const houseCut = Math.round(pot * (HOUSE_CUT_PERCENT / 100));
  const distributable = pot - houseCut;
  const winnerPayout = Math.round(distributable * WINNER_SHARE);
  const runnerUpPayout = distributable - winnerPayout; // remainder, not a second independent round - keeps the two shares summing exactly to distributable

  // Same owner can win AND place runner-up with two different pets - both
  // payouts still land on that one real account, which is correct (addPoints
  // just adds twice to the same balance).
  await addPoints(guildId, { id: winnerEntrant.userId, username: winnerEntrant.username }, winnerPayout);
  await addPoints(guildId, { id: finalLoserEntrant.userId, username: finalLoserEntrant.username }, runnerUpPayout);
  await addToHouseBank(guildId, houseCut);

  winnerPet.tournamentWins += 1;
  await winnerPet.save();
  runnerUpPet.tournamentRunnerUps += 1;
  await runnerUpPet.save();

  tournament.status = "COMPLETED";
  tournament.bracket = bracket;
  tournament.winnerId = winnerEntrant.userId;
  tournament.winnerPetId = winnerPet._id;
  tournament.winnerPetName = winnerPet.speciesName;
  tournament.runnerUpId = finalLoserEntrant.userId;
  tournament.runnerUpPetId = runnerUpPet._id;
  tournament.runnerUpPetName = runnerUpPet.speciesName;
  tournament.pot = pot;
  tournament.houseCut = houseCut;
  tournament.winnerPayout = winnerPayout;
  tournament.runnerUpPayout = runnerUpPayout;
  tournament.resolvedAt = new Date();
  await tournament.save();

  await announceResult(guildId, client, tournament, petNameByPetId);
  await openNextCycle(guildId, client);
}

// Run once after the bot logs in (and mongo is connected) so a guild with a
// pending weekly tournament gets its timer re-armed - including running
// immediately if the scheduled time already passed while the bot was down.
async function rearmScheduledTournaments(client) {
  try {
    const pending = await PetTournament.find({ status: "REGISTRATION", runAt: { $ne: null } });
    for (const tournament of pending) {
      scheduleWeeklyTournament(client, tournament);
    }
    if (pending.length > 0) {
      console.log(`[pet-tournament] re-armed ${pending.length} pending weekly tournament(s)`);
    }
  } catch (err) {
    console.error("[pet-tournament] failed to re-arm scheduled tournaments:", err.message);
  }
}

// Called right after a pet is released (see pet/componentHandler.js) - if
// that exact pet was entered in the guild's current REGISTRATION tournament,
// pulls the registration and refunds the entry fee immediately, instead of
// leaving a "ghost" participant that /펫대전 확인 keeps counting and that
// would otherwise only get quietly dropped (with no refund) once the
// tournament actually runs and finds no pet to battle with.
async function removeParticipantIfRegistered(guildId, userId, petId) {
  const tournament = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  if (!tournament) return;

  const idx = tournament.participants.findIndex((p) => {
    if (p.userId !== userId) return false;
    // Legacy participant records (from before registration pinned a specific
    // petId) can't be disambiguated by pet - any release for this user clears it.
    if (!p.petId) return true;
    return String(p.petId) === String(petId);
  });
  if (idx === -1) return;

  const [removed] = tournament.participants.splice(idx, 1);
  await addPoints(guildId, { id: removed.userId, username: removed.username }, ENTRY_FEE);
  await tournament.save();
}

module.exports = {
  startWeeklyTournament,
  stopWeeklyTournament,
  registerParticipant,
  removeParticipantIfRegistered,
  runTournament,
  scheduleWeeklyTournament,
  rearmScheduledTournaments,
  getNextTournamentTimes,
  buildRound1Matches,
  getPetTournamentBonusBank,
  ENTRY_FEE,
  MIN_PARTICIPANTS,
};
