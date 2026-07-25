const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Tracks every temp voice channel created by the Voicemaster join-to-create system,
// so we know who owns it and can safely clean it up once it's empty.
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TempVoiceChannel", tempVoiceChannelSchema);
