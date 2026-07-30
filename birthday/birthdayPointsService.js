const Birthday = require("../models/birthday");
const { addPoints, getOrCreatePoints } = require("../points/pointsService");

// One-time-per-year bonuses for two "worth celebrating" events:
//   - a registered birthday (/생일추가)
//   - the anniversary of joining THIS server (member.joinedAt - always
//     accurate, no registration needed)
// Both are guarded by a "already paid out for year Y" marker on the relevant
// doc so re-running the check (a plain interval, not a precise midnight cron)
// never double-pays even if it fires more than once on the actual day.
const BIRTHDAY_POINTS = 500;
const ANNIVERSARY_POINTS = 200;

// Hourly is frequent enough - the per-year guard makes over-checking
// harmless, and it means a Railway restart never causes a birthday/anniversary
// to be missed by more than an hour.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isSameUtcMonthDay(a, b) {
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Best-effort announcement in the guild's system channel (the same channel
// Discord's own "X joined the server" messages go to) - there's no per-guild
// config for this, so if the server doesn't have one set (or the bot can't
// post there) we just skip the announcement; the points are still awarded.
async function announce(guild, message) {
  const channel = guild.systemChannel;
  if (!channel) return;
  const me = guild.members.me;
  if (me && !channel.permissionsFor(me)?.has("SendMessages")) return;
  await channel.send(message).catch((err) => console.error("[birthday] announce failed:", err.message));
}

async function checkBirthdays(guild, today, currentYear) {
  // Birthday isn't guild-scoped (one global doc per Discord user), so this
  // query runs once per guild but only pays out/announces for members who are
  // actually in THIS guild - fine for a bot that lives in a single server,
  // and still safe (just slightly redundant work) if it's ever added to more.
  const candidates = await Birthday.find({
    birthday: { $ne: null },
    lastBirthdayPointsYear: { $ne: currentYear },
  });

  for (const doc of candidates) {
    if (!isSameUtcMonthDay(doc.birthday, today)) continue;

    const member = await guild.members.fetch(doc.userId).catch(() => null);
    if (!member) continue;

    doc.lastBirthdayPointsYear = currentYear;
    await doc.save();
    await addPoints(guild.id, member.user, BIRTHDAY_POINTS);
    await announce(guild, `🎂 오늘은 <@${doc.userId}>님의 생일입니다! 축하 포인트 **${BIRTHDAY_POINTS}**를 드렸어요. 다 같이 축하해주세요 🎉`);
  }
}

async function checkAnniversaries(guild, today, currentYear) {
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;

  for (const member of members.values()) {
    if (member.user.bot || !member.joinedAt) continue;
    if (!isSameUtcMonthDay(member.joinedAt, today)) continue;

    const years = currentYear - member.joinedAt.getUTCFullYear();
    if (years < 1) continue; // joined earlier today this year - not an anniversary yet

    const record = await getOrCreatePoints(guild.id, member.user);
    if (record.lastAnniversaryPointsYear === currentYear) continue;

    record.lastAnniversaryPointsYear = currentYear;
    record.points += ANNIVERSARY_POINTS;
    await record.save();
    await announce(
      guild,
      `🎉 <@${member.id}>님이 이 서버에 가입한 지 **${years}주년**이 되었습니다! 기념 포인트 **${ANNIVERSARY_POINTS}**를 드렸어요.`
    );
  }
}

async function runBirthdayAndAnniversaryCheck(client) {
  const today = new Date();
  const currentYear = today.getUTCFullYear();

  for (const guild of client.guilds.cache.values()) {
    await checkBirthdays(guild, today, currentYear).catch((err) =>
      console.error(`[birthday] birthday check failed for guild ${guild.id}:`, err.message)
    );
    await checkAnniversaries(guild, today, currentYear).catch((err) =>
      console.error(`[birthday] anniversary check failed for guild ${guild.id}:`, err.message)
    );
  }
}

function startBirthdayCheckInterval(client) {
  // Run once shortly after startup too, so a redeploy that happens to land on
  // someone's birthday/anniversary doesn't have to wait up to an hour.
  runBirthdayAndAnniversaryCheck(client).catch((err) => console.error("[birthday] initial check failed:", err.message));

  setInterval(() => {
    runBirthdayAndAnniversaryCheck(client).catch((err) => console.error("[birthday] check failed:", err.message));
  }, CHECK_INTERVAL_MS);

  console.log(`[birthday] birthday/anniversary check interval started (every ${CHECK_INTERVAL_MS / 60000}min)`);
}

module.exports = {
  startBirthdayCheckInterval,
  runBirthdayAndAnniversaryCheck,
  BIRTHDAY_POINTS,
  ANNIVERSARY_POINTS,
};
