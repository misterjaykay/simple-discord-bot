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
  // Set via the 해결/진행중/보류/거절 buttons on the mod alert embed (see
  // bamboo/bambooView.js + bamboo/componentHandler.js). "hold"/"inProgress" are
  // the non-terminal statuses besides "pending" - they can still move on to
  // resolved/rejected later, unlike resolved/rejected which lock the buttons
  // and delete the mod-channel message. "archived" is kept only so posts
  // reviewed before the 거절 rename still load - nothing writes it anymore.
  status: {
    type: String,
    enum: ["pending", "resolved", "hold", "inProgress", "rejected", "archived"],
    default: "pending",
  },
  reviewedBy: {
    type: String,
  },
  reviewedAt: {
    type: Date,
  },
  // Only set when status is "rejected" - shown to the author in the rejection DM.
  rejectionReason: {
    type: String,
  },
});

module.exports = mongoose.model("BambooPost", bambooPostSchema);
