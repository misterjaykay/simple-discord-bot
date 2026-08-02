const { getOrCreatePoints, addPoints, todayString } = require("../points/pointsService");
const { createSession, getSession, recordWin, deleteSession } = require("./rpsSession");

// Costs a flat entry fee to start; a loss forfeits it (and anything banked
// this session) entirely - the only way to actually keep points is to cash
// out after a win. See conversation design notes: house edge comes from the
// ×1.5 multiplier being below the "fair" ×2 (at true 50/50 odds, continuing
// past any win is a slightly -EV bet), not from rigging the hand draw.
const ENTRY_FEE = 20;
const BASE_WIN = 30;
const MULTIPLIER = 1.5;
const MAX_STREAK = 6;
const DAILY_SESSION_LIMIT = 5;

// Reveal thresholds (see rps/componentHandler.js) - only "impactful" outcomes
// get posted to the channel; everything else stays ephemeral so the game
// doesn't spam the channel every time someone plays it.
const PUBLIC_WIN_STREAK_THRESHOLD = 5; // cashing out at 5 or 6 wins
const PUBLIC_LOSS_STREAK_THRESHOLD = 3; // had 3+ wins banked when they lost

const HANDS = ["가위", "바위", "보"];
const BEATS = { 가위: "보", 바위: "가위", 보: "바위" };

// PAYOUT_TABLE[streak - 1] = points banked after that many consecutive wins.
// 30 / 45 / 68 / 102 / 153 / 230
const PAYOUT_TABLE = [BASE_WIN];
for (let i = 1; i < MAX_STREAK; i++) {
  PAYOUT_TABLE.push(Math.round(PAYOUT_TABLE[i - 1] * MULTIPLIER));
}

function resolveHands(userHand, botHand) {
  if (userHand === botHand) return "tie";
  return BEATS[userHand] === botHand ? "win" : "lose";
}

// Charges the entry fee and opens a new session. Throws if the daily session
// limit is used up or the player can't afford the entry fee.
async function startSession(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  const today = todayString();

  if (record.rpsSessionsDate !== today) {
    record.rpsSessionsDate = today;
    record.rpsSessionsToday = 0;
  }

  if (record.rpsSessionsToday >= DAILY_SESSION_LIMIT) {
    throw new Error(`오늘 가위바위보는 ${DAILY_SESSION_LIMIT}번 다 사용했어요. 내일 다시 도전해주세요!`);
  }
  if (record.points < ENTRY_FEE) {
    throw new Error(`참가비(${ENTRY_FEE.toLocaleString()} 포인트)가 부족해요. (현재 ${record.points.toLocaleString()} 포인트)`);
  }

  record.points -= ENTRY_FEE;
  record.rpsSessionsToday += 1;
  record.username = user.username ?? record.username;
  await record.save();

  const sessionId = createSession(guildId, user.id);
  return { sessionId, sessionsLeft: DAILY_SESSION_LIMIT - record.rpsSessionsToday };
}

// Plays one round against a random bot hand. Returns one of:
//   { outcome: "expired" }
//   { outcome: "tie", userHand, botHand }
//   { outcome: "lose", userHand, botHand, streakLost, lostAmount }
//   { outcome: "win", userHand, botHand, streak, pendingAmount }
//   { outcome: "capped_win", userHand, botHand, streak, pendingAmount }
function playRound(sessionId, userHand) {
  const session = getSession(sessionId);
  if (!session) return { outcome: "expired" };
  // A capped-out session should already be gone by now (the caller cashes it
  // out immediately on "capped_win" - see rps/componentHandler.js). This is
  // just a defensive backstop so a stray extra call can't push streak past
  // MAX_STREAK and index PAYOUT_TABLE out of bounds.
  if (session.streak >= MAX_STREAK) return { outcome: "expired" };

  const botHand = HANDS[Math.floor(Math.random() * HANDS.length)];
  const result = resolveHands(userHand, botHand);

  if (result === "tie") {
    return { outcome: "tie", userHand, botHand };
  }

  if (result === "lose") {
    const streakLost = session.streak;
    const lostAmount = session.pendingAmount;
    deleteSession(sessionId);
    return { outcome: "lose", userHand, botHand, streakLost, lostAmount };
  }

  const streak = session.streak + 1;
  const pendingAmount = PAYOUT_TABLE[streak - 1];
  recordWin(sessionId, streak, pendingAmount);

  return { outcome: streak >= MAX_STREAK ? "capped_win" : "win", userHand, botHand, streak, pendingAmount };
}

// Banks whatever the session has accumulated and closes it. Safe to call with
// pendingAmount 0 (e.g. a defensive cash-out before any win - just closes the
// session for free). Returns null if the session is already gone (expired).
async function cashOut(sessionId, guildId, user) {
  const session = getSession(sessionId);
  if (!session) return null;

  const { streak, pendingAmount } = session;
  deleteSession(sessionId);

  if (pendingAmount > 0) {
    await addPoints(guildId, user, pendingAmount);
  }
  return { streak, pendingAmount };
}

module.exports = {
  startSession,
  playRound,
  cashOut,
  getSession,
  resolveHands,
  ENTRY_FEE,
  BASE_WIN,
  MULTIPLIER,
  MAX_STREAK,
  DAILY_SESSION_LIMIT,
  PUBLIC_WIN_STREAK_THRESHOLD,
  PUBLIC_LOSS_STREAK_THRESHOLD,
  HANDS,
  PAYOUT_TABLE,
};
