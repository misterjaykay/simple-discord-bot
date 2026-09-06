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

// Only a malformed/foreign sessionId (not a valid ObjectId - e.g. a stray
// customId this handler was never meant to see) should read as "no such
// session". A real DB hiccup (a momentary Atlas connection blip, a timeout)
// must NOT be swallowed the same way - silently treating it as "expired"
// was showing "선택 시간이 만료됐어요" for sessions that still existed and
// hadn't actually expired at all, misleading the user into restarting from
// scratch for what was really just a transient error. Letting it throw here
// means it surfaces as the normal generic-error path (and gets logged)
// instead.
function isMissingSessionError(err) {
  return err.name === "CastError";
}

async function getSession(sessionId) {
  let doc;
  try {
    doc = await PetAdoptSession.findById(sessionId);
  } catch (err) {
    if (isMissingSessionError(err)) return null;
    throw err;
  }
  return doc ? docToSession(doc) : null;
}

async function updateCandidate(sessionId, candidate) {
  let doc;
  try {
    doc = await PetAdoptSession.findByIdAndUpdate(
      sessionId,
      { candidate, $inc: { attemptsUsed: 1 }, lastActivityAt: new Date() },
      { returnDocument: "after" }
    );
  } catch (err) {
    if (isMissingSessionError(err)) return null;
    throw err;
  }
  return doc ? docToSession(doc) : null;
}

async function deleteSession(sessionId) {
  try {
    await PetAdoptSession.findByIdAndDelete(sessionId);
  } catch (err) {
    if (!isMissingSessionError(err)) throw err;
  }
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
