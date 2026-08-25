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
  // /가위바위보 하루 세션 제한 - same reset convention as chatPointsDate/
  // lotteryPlaysDate, but counts sessions (one /가위바위보 run, however many
  // rounds it lasts) rather than individual rounds. See rps/rpsService.js.
  rpsSessionsToday: {
    type: Number,
    default: 0,
  },
  rpsSessionsDate: {
    type: String,
  },
  // How many pet slots (out of petService.MAX_SLOTS) this user has unlocked.
  // Slot 1 is free (everyone starts here); slots 2/3 cost points via /펫슬롯
  // (see petService.SLOT_UNLOCK_COSTS / unlockNextSlot).
  petSlotsUnlocked: {
    type: Number,
    default: 1,
  },
  // Which pet slot is "active" - slot-less /펫밥주기·/펫놀아주기·/펫이름변경·
  // /펫파양 act on this one when the user owns 2+ pets (see petService's
  // getActiveSlot/setActiveSlot/resolvePetForAction, switched via /펫슬롯's
  // 활성화 buttons). Not guaranteed to have a live pet in it - resolvePetForAction
  // falls back to asking the user to pick if this slot was released.
  activePetSlot: {
    type: Number,
    default: 1,
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
  // 일일 미션 (see points/missionService.js) - dailyMissionBonusDate guards the
  // all-5-complete bonus from paying out twice the same day; streak mirrors
  // checkinService's "yesterday or it resets to 1" pattern.
  dailyMissionBonusDate: {
    type: String,
  },
  dailyMissionStreak: {
    type: Number,
    default: 0,
  },
  // 주간 미션 - missionWeekKey is the Monday (per todayString's noon-ET
  // boundary) this week's counters belong to; ensureWeekFresh resets the
  // counts below whenever it no longer matches missionService.weekString().
  missionWeekKey: {
    type: String,
  },
  weeklyFeedCount: {
    type: Number,
    default: 0,
  },
  weeklyPlayCount: {
    type: Number,
    default: 0,
  },
  weeklyAlbaCount: {
    type: Number,
    default: 0,
  },
  weeklyLotteryCount: {
    type: Number,
    default: 0,
  },
  // Guards the weekly all-5 reward from paying out twice in the same week.
  weeklyMissionClaimedWeekKey: {
    type: String,
  },
  // Weekly mission reward buff - multiplies feed/play exp while active (see
  // petService.feedPet/playWithPet). Overwritten (not stacked) each time the
  // weekly mission completes, same "just replace it" pattern as
  // voicePointsService's event-rate override.
  expBuffMultiplier: {
    type: Number,
  },
  expBuffUntil: {
    type: Date,
  },
});

userPointsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const UserPoints = mongoose.model("UserPoints", userPointsSchema);
UserPoints.DEFAULT_STARTING_POINTS = DEFAULT_STARTING_POINTS;

module.exports = UserPoints;
