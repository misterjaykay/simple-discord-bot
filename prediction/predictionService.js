const Prediction = require("../models/prediction");
const { refreshPredictionMessage } = require("./predictionView");

// In-memory only - fine for a single-process bot. Re-armed from the DB on
// startup (see rearmScheduledLocks) so a Railway restart/redeploy doesn't lose
// pending auto-locks.
const scheduledTimers = new Map(); // predictionId (string) -> Timeout

// Node's setTimeout silently misbehaves past ~24.8 days; /예측 생성 caps the
// "시간" option well under that, so this is just a safety net.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// Idempotent: only actually locks if the prediction is still OPEN, so it's safe
// to call this from both the timer firing AND (indirectly) from a manual
// /예측 마감 that beat the clock - whichever happens first wins, the other is a no-op.
async function lockPrediction(client, predictionId, { announce = true } = {}) {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction || prediction.status !== "OPEN") return null;

  prediction.status = "LOCKED";
  await prediction.save();
  await refreshPredictionMessage(client, prediction);

  if (announce) {
    try {
      const channel = await client.channels.fetch(prediction.channelId);
      await channel.send(`⏰ **${prediction.question}** 베팅이 시간 종료로 자동 마감되었습니다.`);
    } catch (err) {
      console.error("[prediction] failed to announce auto-lock:", err);
    }
  }

  return prediction;
}

function clearScheduledLock(predictionId) {
  const id = predictionId.toString();
  const timer = scheduledTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    scheduledTimers.delete(id);
  }
}

function scheduleAutoLock(client, prediction) {
  if (!prediction.lockAt) return;

  const id = prediction._id.toString();
  clearScheduledLock(id);

  const delay = Math.min(Math.max(prediction.lockAt.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
  const timer = setTimeout(() => {
    scheduledTimers.delete(id);
    lockPrediction(client, prediction._id).catch((err) => console.error("[prediction] auto-lock failed:", err));
  }, delay);

  scheduledTimers.set(id, timer);
}

// Run once after the bot logs in (and mongo is connected) so predictions that
// were still OPEN with a pending deadline when the process last stopped get
// their timers re-armed - including firing immediately if the deadline already
// passed while the bot was down.
async function rearmScheduledLocks(client) {
  try {
    const pending = await Prediction.find({ status: "OPEN", lockAt: { $ne: null } });
    for (const prediction of pending) {
      scheduleAutoLock(client, prediction);
    }
    if (pending.length > 0) {
      console.log(`[prediction] re-armed ${pending.length} pending auto-lock timer(s)`);
    }
  } catch (err) {
    console.error("[prediction] failed to re-arm auto-lock timers:", err);
  }
}

module.exports = { lockPrediction, scheduleAutoLock, clearScheduledLock, rearmScheduledLocks };
