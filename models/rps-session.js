const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Backing store for /가위바위보 rounds (see rps/rpsSession.js). Mongo-backed
// rather than an in-process Map for the same reason as
// models/pet-adopt-session.js: a session has to survive whichever process
// ends up handling the *next* button click, not just the one that created
// it - an in-memory-only store falsely shows "만료" if a different live
// process (two instances briefly overlapping during a deploy, or a
// duplicate service) receives that next click.
const rpsSessionSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  streak: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  // TTL keyed off this (bumped on every win) rather than a fixed createdAt -
  // see pet-adopt-session.js for why.
  lastActivityAt: { type: Date, default: Date.now, expires: 5 * 60 },
});

module.exports = mongoose.model("RpsSession", rpsSessionSchema);
