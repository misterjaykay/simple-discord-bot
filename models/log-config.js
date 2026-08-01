const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One doc per guild - each field is the text channel a given log category posts
// to. A missing/undefined field just means that category isn't being logged yet.
const logConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  voiceLogChannelId: { type: String },
  messageLogChannelId: { type: String },
  joinLeaveLogChannelId: { type: String },
  serverLogChannelId: { type: String },
});

module.exports = mongoose.model("LogConfig", logConfigSchema);
