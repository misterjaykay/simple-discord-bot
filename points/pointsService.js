const UserPoints = require("../models/user-points");

// Auto-creates a balance (at the default starting amount) the first time we ever
// see this user in this guild - so nobody has to be manually "signed up".
async function getOrCreatePoints(guildId, user) {
  let record = await UserPoints.findOne({ guildId, userId: user.id });
  if (!record) {
    record = await UserPoints.create({
      guildId,
      userId: user.id,
      username: user.username,
      points: UserPoints.DEFAULT_STARTING_POINTS,
    });
  }
  return record;
}

// amount can be negative (used for corrections / deducting bets).
async function addPoints(guildId, user, amount) {
  const record = await getOrCreatePoints(guildId, user);
  record.points += amount;
  record.username = user.username ?? record.username;
  await record.save();
  return record;
}

// Sets the balance to an exact value rather than adding to whatever it already
// is. Used for admin corrections (e.g. "everyone got an extra grant by mistake,
// reset the whole server to a known baseline") where addPoints' relative math
// would require knowing each person's current, possibly-drifted balance.
async function setPoints(guildId, user, amount) {
  const record = await getOrCreatePoints(guildId, user);
  record.points = amount;
  record.username = user.username ?? record.username;
  await record.save();
  return record;
}

// Top N balances in a guild, highest first. Used by /포인트순위.
async function getLeaderboard(guildId, limit = 10) {
  return UserPoints.find({ guildId }).sort({ points: -1 }).limit(limit);
}

// All daily resets (/출석, 채팅 포인트 일일 캡, /복권 긁기 하루 5회 제한) share this "day"
// definition. It's Eastern-time, but the day only flips over at noon ET rather
// than midnight - plain UTC midnight lands at 7-8 PM ET, which meant everything
// silently reset in the evening instead of overnight.
const DAY_BOUNDARY_TIME_ZONE = "America/New_York";
const DAY_BOUNDARY_HOUR = 12; // noon

function todayString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_BOUNDARY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;

  // en-CA formats as YYYY-MM-DD directly; hour12:false can format midnight as "24".
  const hour = parts.hour === "24" ? 0 : parseInt(parts.hour, 10);
  if (hour >= DAY_BOUNDARY_HOUR) {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  // Still "yesterday" until noon ET - step the calendar date back by one day.
  const rolledBack = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return rolledBack.toISOString().slice(0, 10);
}

module.exports = { getOrCreatePoints, addPoints, setPoints, getLeaderboard, todayString };
