const UserPoints = require("../models/user-points");
const { getOrCreatePoints, todayString } = require("./pointsService");

// Chat is allowed to earn points too, but - unlike voice - it's cheap to spam,
// especially now that there's a reason to want points (/예측 bets). Two guards
// keep it from being a farm:
//   1. A per-user cooldown between eligible messages (in-memory only - losing
//      it on a restart just means one extra early message gets credited,
//      that's fine).
//   2. A hard daily cap tracked on the UserPoints doc itself (chatPointsToday /
//      chatPointsDate), so even someone dodging the cooldown across many
//      channels/sessions can't out-earn the intended amount in a day.
// Voice income (voicePointsService.js) intentionally has no daily cap - it's
// naturally rate-limited by "how many hours can you actually be in a call".
const POINTS_PER_MESSAGE = 5;
const COOLDOWN_MS = 10 * 1000; // 10 seconds between eligible messages, per user
const DAILY_CAP = 150;

const lastMessageAt = new Map(); // `${guildId}:${userId}` -> timestamp

// Returns the points actually awarded (0 if on cooldown or already capped for
// the day), so callers can log/inspect if useful.
async function awardChatPoints(guildId, user) {
  const key = `${guildId}:${user.id}`;
  const now = Date.now();
  const last = lastMessageAt.get(key) ?? 0;
  if (now - last < COOLDOWN_MS) return 0;
  lastMessageAt.set(key, now);

  const record = await getOrCreatePoints(guildId, user);
  const today = todayString();

  if (record.chatPointsDate !== today) {
    record.chatPointsDate = today;
    record.chatPointsToday = 0;
  }

  if (record.chatPointsToday >= DAILY_CAP) return 0;

  const award = Math.min(POINTS_PER_MESSAGE, DAILY_CAP - record.chatPointsToday);
  record.points += award;
  record.chatPointsToday += award;
  record.username = user.username ?? record.username;
  await record.save();

  return award;
}

module.exports = { awardChatPoints, POINTS_PER_MESSAGE, COOLDOWN_MS, DAILY_CAP };
