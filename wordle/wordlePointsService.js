const { addPoints } = require("../points/pointsService");

// The official Wordle Discord bot posts a daily "results" message like:
//   Your group is on a 130 day streak! 🔥🔥🔥 Here are yesterday's results:
//   👑 4/6: @리쿠엘
//   5/6: @namul @하이픽 @Jesyka
//   6/6: @J Moon @Rikimaru
// grouping mentions by how many guesses each person took. A failed attempt is
// conventionally written as "X/6" (literal X, not a digit) instead of a number
// 1-6 - we only award points for the digit lines, so a listed-but-failed user
// (if the bot ever includes those) never gets credited.
const WORDLE_BOT_USERNAME = "wordle";
const POINTS_PER_SOLVE = 100;

function parseSolverIds(content) {
  const solverIds = new Set();

  for (const line of (content || "").split("\n")) {
    if (/\bX\/6:/i.test(line)) continue; // failed attempt line - skip even if someone is mentioned here
    if (!/[1-6]\/6:/.test(line)) continue; // not a results line at all (streak intro, "Play now!", etc.)

    for (const match of line.matchAll(/<@!?(\d+)>/g)) {
      solverIds.add(match[1]);
    }
  }

  return [...solverIds];
}

// Wired up from index.js's MessageCreate handler for every message whose
// author is a bot (human messages go through chatPointsService instead).
// Silently does nothing if the message isn't from the Wordle bot, or doesn't
// contain any parseable results line - so it's safe to call on every bot
// message without pre-filtering by channel.
async function handleWordleResultsMessage(message) {
  if (!message.guild || !message.author?.bot) return;
  if (message.author.username?.toLowerCase() !== WORDLE_BOT_USERNAME) return;

  const solverIds = parseSolverIds(message.content);
  if (solverIds.length === 0) return;

  for (const userId of solverIds) {
    // Only the user ID is available here (parsed out of message text, not a
    // real fetched User object) - addPoints/getOrCreatePoints handle a
    // username-less user fine, backfilling it later once this person uses
    // any other points-aware command.
    await addPoints(message.guild.id, { id: userId }, POINTS_PER_SOLVE).catch((err) =>
      console.error(`[wordle] failed to award points to ${userId}:`, err.message)
    );
  }

  await message.channel
    .send(`🟩 오늘 워들 정답자 ${solverIds.length}명에게 ${POINTS_PER_SOLVE.toLocaleString()}포인트씩 지급했습니다!`)
    .catch((err) => console.error("[wordle] failed to send summary message:", err.message));
}

module.exports = { handleWordleResultsMessage, parseSolverIds, WORDLE_BOT_USERNAME, POINTS_PER_SOLVE };
