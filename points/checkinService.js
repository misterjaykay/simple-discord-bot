const { getOrCreatePoints, todayString } = require("./pointsService");

// A small flat daily login incentive, plus a modest streak bonus so people who
// check in every single day earn a bit more than someone who only drops by
// once in a while - same spirit as chatPointsService's daily cap, but
// rewarding showing up instead of just capping spam.
const BASE_POINTS = 30;
const STREAK_BONUS_PER_DAY = 2;
const STREAK_BONUS_CAP = 20; // bonus maxes out once the streak hits 11 days

// Derived from todayString() (24h earlier) rather than a plain UTC-1 shift, so
// streak continuity uses the exact same noon-ET day boundary as "today" does.
function yesterdayString() {
  return todayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

// Returns { alreadyCheckedIn, awarded, streak, totalCheckins }. alreadyCheckedIn
// is true when this is a repeat call for the same day - no points are awarded
// in that case, streak/totalCheckins are just echoed back as-is.
async function checkIn(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  const today = todayString();

  if (record.lastCheckinDate === today) {
    return { alreadyCheckedIn: true, awarded: 0, streak: record.checkinStreak, totalCheckins: record.totalCheckins };
  }

  // Streak continues only if the last check-in was exactly yesterday -
  // anything older (or no prior check-in at all) restarts it at 1.
  record.checkinStreak = record.lastCheckinDate === yesterdayString() ? record.checkinStreak + 1 : 1;
  record.lastCheckinDate = today;
  record.totalCheckins = (record.totalCheckins ?? 0) + 1;
  if (!record.firstCheckinDate) record.firstCheckinDate = today;

  const bonus = Math.min(STREAK_BONUS_PER_DAY * (record.checkinStreak - 1), STREAK_BONUS_CAP);
  const awarded = BASE_POINTS + bonus;
  record.points += awarded;
  record.username = user.username ?? record.username;
  await record.save();

  return { alreadyCheckedIn: false, awarded, streak: record.checkinStreak, totalCheckins: record.totalCheckins };
}

// Attendance rate = totalCheckins / days elapsed since their FIRST /출석 (not
// since they joined the server - the feature didn't exist before that, so
// counting from server-join would unfairly tank long-time members' rate).
// Returns rate: null when the user has never checked in.
async function getAttendanceStats(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  if (!record.firstCheckinDate) {
    return { totalCheckins: 0, streak: 0, rate: null, daysTracked: 0 };
  }

  const first = new Date(record.firstCheckinDate + "T00:00:00.000Z");
  const today = new Date(todayString() + "T00:00:00.000Z");
  const daysTracked = Math.round((today - first) / (24 * 60 * 60 * 1000)) + 1;
  const rate = Math.round((record.totalCheckins / daysTracked) * 1000) / 10; // one decimal place

  return { totalCheckins: record.totalCheckins, streak: record.checkinStreak, rate, daysTracked };
}

module.exports = { checkIn, getAttendanceStats, BASE_POINTS, STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP };
