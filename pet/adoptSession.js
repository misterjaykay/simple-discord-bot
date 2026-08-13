const crypto = require("crypto");

// In-memory only, keyed by a random session id embedded in the button
// customIds ("pet:reroll:<id>" / "pet:confirm:<id>"). Nothing is written to
// Mongo (and no points are spent) until the user hits "확정" - so if the bot
// restarts mid-selection, the preview is simply lost and the old message's
// buttons go inert. Nobody loses points for that, they just re-run /펫입양.
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes of inactivity auto-expires a preview

const sessions = new Map(); // sessionId -> { guildId, userId, candidate, targetSlot, attemptsUsed, timeout }

function scheduleExpiry(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeout) clearTimeout(session.timeout);
  session.timeout = setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS);
  session.timeout.unref?.();
}

// targetSlot is fixed for the life of the session (rerolling only changes the
// candidate species, not which empty slot it'll land in) - confirmAdopt
// recomputes it fresh anyway right before committing, so this is display-only.
function createSession(guildId, userId, candidate, targetSlot) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { guildId, userId, candidate, targetSlot, attemptsUsed: 1 });
  scheduleExpiry(sessionId);
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function updateCandidate(sessionId, candidate) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.candidate = candidate;
  session.attemptsUsed += 1;
  scheduleExpiry(sessionId);
  return session;
}

function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session?.timeout) clearTimeout(session.timeout);
  sessions.delete(sessionId);
}

module.exports = { createSession, getSession, updateCandidate, deleteSession, SESSION_TTL_MS };
