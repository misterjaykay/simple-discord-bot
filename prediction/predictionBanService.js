const { getOrCreatePoints } = require("../points/pointsService");

// Manual moderation tool - a mod hears someone cursing in chat and wants to
// block them from placing new /예측 bets for a while (or indefinitely) as a
// warning. Deliberately not an automated profanity filter - the mod is the
// one judging what counts and issuing the restriction; the bot only enforces
// it once applied. See commands/prediction-ban.js for the /예측제재 command.

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

async function banFromPrediction(guildId, user, minutes, reason) {
  const record = await getOrCreatePoints(guildId, user);
  record.predictionBanned = true;
  record.predictionBanUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000) : undefined;
  record.predictionBanReason = reason || undefined;
  await record.save();
  return record;
}

async function unbanFromPrediction(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  record.predictionBanned = false;
  record.predictionBanUntil = undefined;
  record.predictionBanReason = undefined;
  await record.save();
  return record;
}

// Reads the current ban status, self-healing an expired temporary ban back to
// "not banned" the moment it's checked (rather than needing a background job)
// so /예측제재 확인 and the bet-time check both always see accurate state.
async function getBanStatus(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  if (!record.predictionBanned) return { banned: false };

  if (record.predictionBanUntil && record.predictionBanUntil <= new Date()) {
    record.predictionBanned = false;
    record.predictionBanUntil = undefined;
    record.predictionBanReason = undefined;
    await record.save();
    return { banned: false };
  }

  return {
    banned: true,
    until: record.predictionBanUntil || null, // null = indefinite
    reason: record.predictionBanReason || null,
  };
}

// User-facing Korean message shown when a banned user tries to bet.
function banMessage(status) {
  const reasonLine = status.reason ? ` (사유: ${status.reason})` : "";
  if (!status.until) {
    return `🚫 예측 참여가 제한되어 있어요${reasonLine}. 관리자가 직접 해제하기 전까지는 베팅할 수 없어요.`;
  }
  return `🚫 예측 참여가 제한되어 있어요${reasonLine}. <t:${Math.floor(status.until.getTime() / 1000)}:R>에 해제돼요.`;
}

module.exports = { banFromPrediction, unbanFromPrediction, getBanStatus, banMessage, formatDuration };
