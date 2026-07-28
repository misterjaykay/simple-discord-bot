const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Everyone starts with this many points the first time they're seen (checking
// balance, placing a bet, etc). Admins can additionally hand out points on top
// of this via /포인트관리.
const DEFAULT_STARTING_POINTS = 1000;

const userPointsSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
  },
  points: {
    type: Number,
    default: DEFAULT_STARTING_POINTS,
  },
  // Tracks today's chat-earned total so it can be capped (voice income is left
  // uncapped by design - only chat needs a ceiling since it's the one that can
  // be spammed). Resets whenever chatPointsDate no longer matches "today".
  chatPointsToday: {
    type: Number,
    default: 0,
  },
  chatPointsDate: {
    type: String, // "YYYY-MM-DD" in server-local time
  },
});

userPointsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const UserPoints = mongoose.model("UserPoints", userPointsSchema);
UserPoints.DEFAULT_STARTING_POINTS = DEFAULT_STARTING_POINTS;

module.exports = UserPoints;
