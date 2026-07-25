const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One doc per "Join to Create" trigger channel. A guild can have several of these
// (e.g. one for gaming, one for studying), each with its own name template and
// owner role - this is what VoiceMaster's SaaS version paywalls as "unlimited
// generators"; since we run our own code there's no reason to limit it.
const voiceMasterConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  triggerChannelId: {
    type: String,
    required: true,
    unique: true,
  },
  categoryId: {
    type: String,
  },
  // {user} gets replaced with the creator's display name.
  nameTemplate: {
    type: String,
    default: "{user}의 채널",
  },
  // Optional role auto-granted to whoever currently owns a channel created from
  // this trigger, and auto-removed when they stop owning it.
  ownerRoleId: {
    type: String,
  },
});

module.exports = mongoose.model("VoiceMasterConfig", voiceMasterConfigSchema);
