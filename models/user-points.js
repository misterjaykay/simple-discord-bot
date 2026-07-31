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
  // /출석 (daily check-in) bookkeeping - see points/checkinService.js.
  lastCheckinDate: {
    type: String, // "YYYY-MM-DD", same convention as chatPointsDate
  },
  checkinStreak: {
    type: Number,
    default: 0,
  },
  totalCheckins: {
    type: Number,
    default: 0,
  },
  // Date of this user's very first /출석, used as the denominator for
  // attendance rate instead of their server-join date (they may have joined
  // long before the check-in feature existed).
  firstCheckinDate: {
    type: String,
  },
  // Guards the join-anniversary bonus (see birthday/birthdayPointsService.js)
  // against being paid out more than once in the same year.
  lastAnniversaryPointsYear: {
    type: Number,
  },
  // /복권 긁기 (instant lottery) daily play cap - same reset convention as
  // chatPointsToday/chatPointsDate. See commands/lottery.js.
  lotteryPlaysToday: {
    type: Number,
    default: 0,
  },
  lotteryPlaysDate: {
    type: String,
  },
  // Manual moderation action (e.g. someone cursed in chat) that blocks a user
  // from placing new /예측 bets - never automated, always applied by a mod via
  // /예측제재. See prediction/predictionBanService.js.
  predictionBanned: {
    type: Boolean,
    default: false,
  },
  // Optional auto-expiry for the above - null/unset means the ban is
  // indefinite until a mod runs /예측제재 해제.
  predictionBanUntil: {
    type: Date,
  },
  predictionBanReason: {
    type: String,
  },
});

userPointsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const UserPoints = mongoose.model("UserPoints", userPointsSchema);
UserPoints.DEFAULT_STARTING_POINTS = DEFAULT_STARTING_POINTS;

module.exports = UserPoints;
