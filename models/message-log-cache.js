const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Short-lived local copy of message content, purely so message-log can show
// "before" text on edits/deletes - Discord's delete event never includes the
// original content, and discord.js's in-memory message cache is wiped on every
// bot restart. The `expires` TTL auto-deletes docs 48h after creation so this
// can never grow unbounded.
const messageLogCacheSchema = new Schema({
  messageId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  authorId: { type: String, required: true },
  authorTag: { type: String },
  content: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, expires: "48h" },
});

module.exports = mongoose.model("MessageLogCache", messageLogCacheSchema);
