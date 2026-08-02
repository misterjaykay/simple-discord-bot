const crypto = require("crypto");

// In-memory only, keyed by a random session id embedded in the button
// customIds ("rps:hand:가위:<id>" etc). The entry fee is already spent by the
// time a session exists (see rpsService.startSession), so if the bot restarts
// or a session just times out mid-game, the player loses access to whatever
// they had banked - same tradeoff as walking away from a slot machine mid-spin.
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes of inactivity auto-expires a session

const sessions = new Map(); // sessionId -> { guildId, userId, streak, pendingAmount, timeout }

function scheduleExpiry(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeout) clearTimeout(session.timeout);
  session.timeout = setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS);
  session.timeout.unref?.();
}

function createSession(guildId, userId) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { guildId, userId, streak: 0, pendingAmount: 0 });
  scheduleExpiry(sessionId);
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function recordWin(sessionId, streak, pendingAmount) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.streak = streak;
  session.pendingAmount = pendingAmount;
  scheduleExpiry(sessionId);
  return session;
}

function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session?.timeout) clearTimeout(session.timeout);
  sessions.delete(sessionId);
}

module.exports = { createSession, getSession, recordWin, deleteSession, SESSION_TTL_MS };
