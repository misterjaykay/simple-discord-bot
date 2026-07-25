const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One "Join to Create" configuration per guild.
const voiceMasterConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  triggerChannelId: {
    type: String,
    required: true,
  },
  categoryId: {
    type: String,
  },
});

module.exports = mongoose.model("VoiceMasterConfig", voiceMasterConfigSchema);
