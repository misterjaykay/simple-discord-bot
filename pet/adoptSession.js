const PetAdoptSession = require("../models/pet-adopt-session");

// Mongo-backed (see models/pet-adopt-session.js for why) - keyed by the
// document's own _id, embedded in the button customIds
// ("pet:reroll:<id>" / "pet:confirm:<id>"). Nothing else is written to Mongo
// (and no points are spent) until the user hits "확정" - so if the bot
// restarts mid-selection, the preview is simply lost and the old message's
// buttons go inert. Nobody loses points for that, they just re-run /펫입양.
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes of inactivity auto-expires a preview

// targetSlot is fixed for the life of the session (rerolling only changes the
// candidate species, not which empty slot it'll land in) - confirmAdopt
// recomputes it fresh anyway right before committing, so this is display-only.
// generation is likewise fixed - every reroll in this session redraws from
// the same generation pool the user originally picked (see componentHandler's
// reroll handler).
async function createSession(guildId, userId, candidate, targetSlot, generation) {
  const doc = await PetAdoptSession.create({ guildId, userId, candidate, targetSlot, generation, attemptsUsed: 1 });
  return doc._id.toString();
}

async function getSession(sessionId) {
  const doc = await PetAdoptSession.findById(sessionId).catch(() => null);
  return doc ? docToSession(doc) : null;
}

async function updateCandidate(sessionId, candidate) {
  const doc = await PetAdoptSession.findByIdAndUpdate(
    sessionId,
    { candidate, $inc: { attemptsUsed: 1 }, lastActivityAt: new Date() },
    { returnDocument: "after" }
  ).catch(() => null);
  return doc ? docToSession(doc) : null;
}

async function deleteSession(sessionId) {
  await PetAdoptSession.findByIdAndDelete(sessionId).catch(() => {});
}

// Mirrors the old in-memory session's plain-object shape so callers
// (pet/componentHandler.js, pet/adoptView.js) don't need to know this is now
// a Mongoose document.
function docToSession(doc) {
  return {
    guildId: doc.guildId,
    userId: doc.userId,
    candidate: doc.candidate,
    targetSlot: doc.targetSlot,
    generation: doc.generation,
    attemptsUsed: doc.attemptsUsed,
  };
}

module.exports = { createSession, getSession, updateCandidate, deleteSession, SESSION_TTL_MS };
