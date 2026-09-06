const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Backing store for the /펫입양 reroll/confirm flow (see pet/adoptSession.js).
// Mongo-backed rather than an in-process Map so the session survives
// whichever process ends up handling the *next* button click, not just the
// one that created it - Discord's gateway can deliver different interactions
// for the same flow to different live processes (two instances briefly
// overlapping during a deploy, or a duplicate service), and an in-memory-only
// store would show every such split as a false "선택 시간이 만료됐어요" even
// seconds after the session was created.
const petAdoptSessionSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  candidate: { type: Schema.Types.Mixed, required: true }, // drawCandidate()'s return shape
  targetSlot: { type: Number, required: true },
  generation: { type: Number, required: true },
  attemptsUsed: { type: Number, default: 1 },
  // TTL keyed off this (bumped on every reroll) rather than a fixed createdAt,
  // so "5 minutes of inactivity" resets each time instead of the whole
  // session expiring 5 min after the very first draw - Mongo's TTL sweep
  // re-evaluates against whatever value is currently stored here.
  lastActivityAt: { type: Date, default: Date.now, expires: 5 * 60 },
});

module.exports = mongoose.model("PetAdoptSession", petAdoptSessionSchema);
