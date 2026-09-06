const RpsSession = require("../models/rps-session");

// Mongo-backed (see models/rps-session.js for why) - keyed by the document's
// own _id, embedded in the button customIds ("rps:hand:가위:<id>" etc). The
// entry fee is already spent by the time a session exists (see
// rpsService.startSession), so if the bot restarts or a session just times
// out mid-game, the player loses access to whatever they had banked - same
// tradeoff as walking away from a slot machine mid-spin.
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes of inactivity auto-expires a session

async function createSession(guildId, userId) {
  const doc = await RpsSession.create({ guildId, userId, streak: 0, pendingAmount: 0 });
  return doc._id.toString();
}

async function getSession(sessionId) {
  const doc = await RpsSession.findById(sessionId).catch(() => null);
  return doc ? docToSession(doc) : null;
}

async function recordWin(sessionId, streak, pendingAmount) {
  const doc = await RpsSession.findByIdAndUpdate(
    sessionId,
    { streak, pendingAmount, lastActivityAt: new Date() },
    { returnDocument: "after" }
  ).catch(() => null);
  return doc ? docToSession(doc) : null;
}

async function deleteSession(sessionId) {
  await RpsSession.findByIdAndDelete(sessionId).catch(() => {});
}

// Mirrors the old in-memory session's plain-object shape so callers
// (rps/rpsService.js, rps/componentHandler.js) don't need to know this is
// now a Mongoose document.
function docToSession(doc) {
  return { guildId: doc.guildId, userId: doc.userId, streak: doc.streak, pendingAmount: doc.pendingAmount };
}

module.exports = { createSession, getSession, recordWin, deleteSession, SESSION_TTL_MS };
