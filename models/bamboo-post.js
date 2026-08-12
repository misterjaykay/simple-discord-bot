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
  // Set via the 해결/보류/삭제 buttons on the mod alert embed (see
  // bamboo/bambooView.js + bamboo/componentHandler.js). "hold" is the only
  // non-terminal status besides "pending" - it can still move to
  // resolved/archived later, unlike resolved/archived which lock the buttons.
  status: {
    type: String,
    enum: ["pending", "resolved", "hold", "archived"],
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
