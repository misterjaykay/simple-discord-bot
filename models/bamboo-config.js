const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One doc per guild - where /대나무숲 submissions get posted for mods to see.
// This channel should NOT be visible to regular members; that's enforced by
// the server's own channel permissions, not by this bot.
const bambooConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  alertChannelId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("BambooConfig", bambooConfigSchema);
