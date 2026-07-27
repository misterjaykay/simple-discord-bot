const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const BUTTON_STYLES = [ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Success, ButtonStyle.Secondary];
const STATUS_LABEL = {
  OPEN: "🟢 베팅 중",
  LOCKED: "🔒 베팅 마감",
  RESOLVED: "✅ 종료됨",
  CANCELLED: "❌ 취소됨",
};

function potForOption(prediction, optionIndex) {
  return prediction.bets.filter((b) => b.optionIndex === optionIndex).reduce((sum, b) => sum + b.amount, 0);
}

// Who bet how much on this option, biggest stake first - so it's visible to
// everyone in the channel while betting is still open, not just the totals.
// Field values are capped at 1024 chars by Discord, so this truncates to a
// safe length and folds anything past that into a "...외 N명" count instead
// of silently erroring on a field that grew too long.
function formatBettors(prediction, optionIndex) {
  const bets = prediction.bets
    .filter((b) => b.optionIndex === optionIndex)
    .sort((a, b) => b.amount - a.amount);

  if (bets.length === 0) return "_아직 베팅한 사람이 없어요_";

  const entries = bets.map((b) => `<@${b.userId}> ${b.amount.toLocaleString()}`);

  let shown = entries;
  let hiddenCount = 0;
  while (shown.join(", ").length > 900 && shown.length > 1) {
    shown = shown.slice(0, -1);
    hiddenCount = entries.length - shown.length;
  }

  return shown.join(", ") + (hiddenCount > 0 ? ` 외 ${hiddenCount}명` : "");
}

// Pari-mutuel odds (same math /예측 종료 actually pays out with): a bet of X on an
// option worth W out of total pot P returns X * (P / W). So the "live" multiplier
// for that option is simply P / W - it drops as more points pile onto that side,
// and rises as fewer people back it. Returns null when nobody has bet on the
// option yet, since the multiplier isn't defined until there's a real pool to
// divide (first bet on an empty option always gets 1x - it's the only stake).
function computeOdds(prediction, optionIndex) {
  const totalPot = prediction.bets.reduce((sum, b) => sum + b.amount, 0);
  const pot = potForOption(prediction, optionIndex);
  if (totalPot === 0 || pot === 0) return null;
  return totalPot / pot;
}

function buildPredictionMessage(prediction, forceDisableButtons = false) {
  const totalPot = prediction.bets.reduce((sum, b) => sum + b.amount, 0);

  const deadlineLine =
    prediction.status === "OPEN" && prediction.lockAt
      ? `⏰ 자동 마감: <t:${Math.floor(new Date(prediction.lockAt).getTime() / 1000)}:R>\n`
      : "";

  const embed = new EmbedBuilder()
    .setTitle(`🎲 ${prediction.question}`)
    .setDescription(`${STATUS_LABEL[prediction.status]}\n${deadlineLine}총 판돈: ${totalPot.toLocaleString()} 포인트`)
    .setColor(prediction.status === "RESOLVED" ? 0x57f287 : prediction.status === "CANCELLED" ? 0xed4245 : 0x5865f2)
    .setFooter({ text: "배당은 베팅이 몰릴수록 실시간으로 변해요 · /포인트 로 잔액 확인" });

  prediction.options.forEach((label, i) => {
    const pot = potForOption(prediction, i);
    const pct = totalPot > 0 ? Math.round((pot / totalPot) * 100) : 0;
    const trophy = prediction.winningOptionIndex === i ? " 🏆" : "";
    const odds = computeOdds(prediction, i);
    const oddsText = odds ? `${odds.toFixed(2)}x` : "-";
    embed.addFields({
      name: `${i + 1}. ${label}${trophy} - ${pot.toLocaleString()} 포인트 (${pct}%) · 배당 ${oddsText}`,
      value: formatBettors(prediction, i),
    });
  });

  const disabled = forceDisableButtons || prediction.status !== "OPEN";
  const row = new ActionRowBuilder().addComponents(
    prediction.options.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`pred:bet:${i}`)
        .setLabel(label)
        .setStyle(BUTTON_STYLES[i] ?? ButtonStyle.Secondary)
        .setDisabled(disabled)
    )
  );

  return { embeds: [embed], components: [row] };
}

async function refreshPredictionMessage(client, prediction, forceDisableButtons = false) {
  try {
    const channel = await client.channels.fetch(prediction.channelId);
    const message = await channel.messages.fetch(prediction.messageId);
    await message.edit(buildPredictionMessage(prediction, forceDisableButtons));
  } catch (err) {
    console.error("[prediction] failed to refresh message:", err);
  }
}

module.exports = { buildPredictionMessage, refreshPredictionMessage, computeOdds };
