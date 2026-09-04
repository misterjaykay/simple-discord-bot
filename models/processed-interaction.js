const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Exactly-once claim ticket for a Discord interaction id - see
// interactionClaim.js. Discord's gateway can occasionally deliver the same
// interaction to more than one live bot process (most commonly during a
// rolling deploy, where the old and new instance briefly overlap and both
// hold a gateway connection on the same bot token); without this, each
// process independently runs the full command handler - including its DB
// side effects (deduct points, increment a daily counter) - even though only
// one of them can ever win the actual Discord reply. TTL-expires quickly
// since an interaction id is only ever relevant for the few seconds around
// when it's received.
const processedInteractionSchema = new Schema({
  interactionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 }, // 1 hour TTL
});

module.exports = mongoose.model("ProcessedInteraction", processedInteractionSchema);
