const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const BUTTON_STYLES = [ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Success, ButtonStyle.Secondary];
const STATUS_LABEL = {
  OPEN: "🟢 베팅 중",
  LOCKED: "🔒 베팅 마감",
  RESOLVED: "✅ 종료됨",
  CANCELLED: "❌ 취소됨",
};

function buildPredictionMessage(prediction, forceDisableButtons = false) {
  const totalPot = prediction.bets.reduce((sum, b) => sum + b.amount, 0);

  const lines = prediction.options.map((label, i) => {
    const pot = prediction.bets.filter((b) => b.optionIndex === i).reduce((sum, b) => sum + b.amount, 0);
    const pct = totalPot > 0 ? Math.round((pot / totalPot) * 100) : 0;
    const trophy = prediction.winningOptionIndex === i ? " 🏆" : "";
    return `**${i + 1}. ${label}**${trophy} - ${pot.toLocaleString()} 포인트 (${pct}%)`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎲 ${prediction.question}`)
    .setDescription(`${STATUS_LABEL[prediction.status]}\n총 판돈: ${totalPot.toLocaleString()} 포인트\n\n${lines.join("\n")}`)
    .setColor(prediction.status === "RESOLVED" ? 0x57f287 : prediction.status === "CANCELLED" ? 0xed4245 : 0x5865f2)
    .setFooter({ text: "/포인트 로 잔액 확인 · 아래 버튼을 눌러 베팅하세요" });

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

module.exports = { buildPredictionMessage, refreshPredictionMessage };
