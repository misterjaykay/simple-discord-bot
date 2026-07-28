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

function todayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

module.exports = { getOrCreatePoints, addPoints, setPoints, getLeaderboard, todayString };
