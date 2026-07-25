const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Tracks every temp voice channel created by the Voicemaster join-to-create system,
// so we know who owns it and can safely clean it up (and revoke any owner role)
// once it's empty.
const tempVoiceChannelSchema = new Schema({
  channelId: {
    type: String,
    required: true,
    unique: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  ownerId: {
    type: String,
    required: true,
  },
  // Snapshot of the trigger's owner role (if any) at creation time, so we know
  // exactly what to revoke even if the trigger's config changes later.
  ownerRoleId: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TempVoiceChannel", tempVoiceChannelSchema);
