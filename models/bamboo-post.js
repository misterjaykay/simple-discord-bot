const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// /대나무숲 submissions. Never anonymous - authorId is always stored so mods
// can trace a submission back to its author if something crosses a line -
// but the bot never surfaces authorship (or the submission at all) outside
// the mod alert channel. See bamboo/componentHandler.js.
const bambooPostSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  authorId: {
    type: String,
    required: true,
  },
  authorUsername: {
    type: String,
  },
  category: {
    type: String,
    enum: ["report", "suggestion", "complaint", "concern"],
    required: true,
  },
  // Only set for category "report" - who the report is about.
  targetUserId: {
    type: String,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Purely informational for mods - the bot never acts on this itself.
  status: {
    type: String,
    enum: ["pending", "reviewed", "dismissed"],
    default: "pending",
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
});

module.exports = mongoose.model("BambooPost", bambooPostSchema);
