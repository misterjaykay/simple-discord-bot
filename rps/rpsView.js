const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ENTRY_FEE, MAX_STREAK, HANDS } = require("./rpsService");

const HAND_EMOJI = { 가위: "✌️", 바위: "✊", 보: "✋" };

function buildHandRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    HANDS.map((hand) =>
      new ButtonBuilder().setCustomId(`rps:hand:${hand}:${sessionId}`).setLabel(hand).setEmoji(HAND_EMOJI[hand]).setStyle(ButtonStyle.Primary)
    )
  );
}

function buildHandChoiceMessage(sessionId, streak, pendingAmount) {
  const embed = new EmbedBuilder()
    .setTitle("✂️ 가위바위보")
    .setDescription(
      streak === 0
        ? `참가비 ${ENTRY_FEE.toLocaleString()} 포인트를 냈습니다. 가위/바위/보 중 하나를 선택하세요!`
        : `${streak}연승 중! 확보한 포인트: **${pendingAmount.toLocaleString()}**\n다음 판에 도전할 가위/바위/보를 선택하세요.`
    )
    .setColor(0x5865f2);
  return { embeds: [embed], components: [buildHandRow(sessionId)] };
}

function buildTieMessage(sessionId, userHand, botHand) {
  const embed = new EmbedBuilder()
    .setTitle("🤝 무승부!")
    .setDescription(`${userHand} vs ${botHand} - 다시 선택하세요! (연승/참가비엔 영향 없어요)`)
    .setColor(0xf1c40f);
  return { embeds: [embed], components: [buildHandRow(sessionId)] };
}

function buildWinMessage(sessionId, userHand, botHand, streak, pendingAmount) {
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${streak}연승!`)
    .setDescription(`${userHand} vs ${botHand} - 승리! 확보한 포인트: **${pendingAmount.toLocaleString()}**\n계속 도전할까요, 여기서 받을까요?`)
    .setColor(0x57f287);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rps:continue:${sessionId}`).setLabel("계속하기").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rps:cashout:${sessionId}`).setLabel(`그만받기 (+${pendingAmount.toLocaleString()})`).setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

function buildCappedWinMessage(userHand, botHand, pendingAmount) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 최대 ${MAX_STREAK}연승 달성!`)
    .setDescription(`${userHand} vs ${botHand} - 승리! 최대 기록이라 자동으로 **${pendingAmount.toLocaleString()} 포인트** 지급됐어요.`)
    .setColor(0xffd700);
  return { embeds: [embed], components: [] };
}

function buildLoseMessage(userHand, botHand) {
  const embed = new EmbedBuilder()
    .setTitle("💥 졌습니다")
    .setDescription(`${userHand} vs ${botHand} - 패배! 이번 세션은 여기서 끝, 확보했던 포인트는 못 받아요.`)
    .setColor(0xed4245);
  return { embeds: [embed], components: [] };
}

function buildCashOutMessage(streak, pendingAmount) {
  const embed = new EmbedBuilder()
    .setTitle("💰 받았습니다!")
    .setDescription(`${streak}연승에서 멈추고 **${pendingAmount.toLocaleString()} 포인트**를 받았습니다.`)
    .setColor(0x57f287);
  return { embeds: [embed], components: [] };
}

function buildExpiredMessage() {
  return { content: "게임 시간이 만료됐어요. `/가위바위보`를 다시 실행해주세요.", embeds: [], components: [] };
}

function buildPublicWinMessage(user, streak, pendingAmount) {
  return `🏆 <@${user.id}>님이 가위바위보 **${streak}연승**을 달성해서 **${pendingAmount.toLocaleString()} 포인트**를 받았습니다!`;
}

function buildPublicLossMessage(user, userHand, botHand, streakLost, lostAmount) {
  return `💥 <@${user.id}>님이 가위바위보 **${streakLost}연승**(${lostAmount.toLocaleString()} 포인트)까지 쌓아놓고 ${userHand} vs ${botHand}로 전부 날렸습니다...`;
}

module.exports = {
  buildHandChoiceMessage,
  buildTieMessage,
  buildWinMessage,
  buildCappedWinMessage,
  buildLoseMessage,
  buildCashOutMessage,
  buildExpiredMessage,
  buildPublicWinMessage,
  buildPublicLossMessage,
};
