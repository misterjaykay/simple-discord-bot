const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Per-guild overrides for point-earning rates - lets admins run temporary
// events (e.g. "Happy Friday" double voice points) without a code change or
// redeploy. Only one field is used today (voicePointsPerInterval) but this is
// kept as its own small collection so future event knobs (chat rate, etc.)
// can be added the same way.
const guildPointsConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  // Overrides voicePointsService's default points-per-5-minutes while set.
  voicePointsPerInterval: {
    type: Number,
  },
  // When set, the override above auto-reverts to the default once this time
  // passes (re-armed from the DB on startup, same pattern as prediction auto-lock).
  voicePointsExpiresAt: {
    type: Date,
  },
});

module.exports = mongoose.model("GuildPointsConfig", guildPointsConfigSchema);
