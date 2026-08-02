const { getSession, playRound, cashOut, PUBLIC_WIN_STREAK_THRESHOLD, PUBLIC_LOSS_STREAK_THRESHOLD } = require("./rpsService");
const {
  buildHandChoiceMessage,
  buildTieMessage,
  buildWinMessage,
  buildCappedWinMessage,
  buildLoseMessage,
  buildCashOutMessage,
  buildExpiredMessage,
  buildPublicWinMessage,
  buildPublicLossMessage,
} = require("./rpsView");

async function handleHandChoice(interaction, hand, sessionId, session) {
  const result = playRound(sessionId, hand);

  if (result.outcome === "tie") {
    return interaction.update(buildTieMessage(sessionId, result.userHand, result.botHand));
  }

  if (result.outcome === "lose") {
    await interaction.update(buildLoseMessage(result.userHand, result.botHand));
    if (result.streakLost >= PUBLIC_LOSS_STREAK_THRESHOLD) {
      await interaction.channel
        .send(buildPublicLossMessage(interaction.user, result.userHand, result.botHand, result.streakLost, result.lostAmount))
        .catch((err) => console.error("[rps] public loss announcement failed:", err.message));
    }
    return;
  }

  if (result.outcome === "capped_win") {
    await cashOut(sessionId, session.guildId, interaction.user);
    await interaction.update(buildCappedWinMessage(result.userHand, result.botHand, result.pendingAmount));
    await interaction.channel
      .send(buildPublicWinMessage(interaction.user, result.streak, result.pendingAmount))
      .catch((err) => console.error("[rps] public win announcement failed:", err.message));
    return;
  }

  // normal win - offer 계속하기/그만받기
  return interaction.update(buildWinMessage(sessionId, result.userHand, result.botHand, result.streak, result.pendingAmount));
}

async function handleContinue(interaction, sessionId, session) {
  return interaction.update(buildHandChoiceMessage(sessionId, session.streak, session.pendingAmount));
}

async function handleCashOut(interaction, sessionId, session) {
  const result = await cashOut(sessionId, session.guildId, interaction.user);
  if (!result) return interaction.update(buildExpiredMessage());

  await interaction.update(buildCashOutMessage(result.streak, result.pendingAmount));
  if (result.streak >= PUBLIC_WIN_STREAK_THRESHOLD) {
    await interaction.channel
      .send(buildPublicWinMessage(interaction.user, result.streak, result.pendingAmount))
      .catch((err) => console.error("[rps] public win announcement failed:", err.message));
  }
}

async function handleRpsComponent(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const sessionId = action === "hand" ? parts[3] : parts[2];

  const session = getSession(sessionId);
  if (!session) {
    return interaction.update(buildExpiredMessage());
  }
  if (session.userId !== interaction.user.id) {
    return interaction.reply({ content: "본인이 시작한 게임만 조작할 수 있어요.", ephemeral: true });
  }

  if (action === "hand") {
    return handleHandChoice(interaction, parts[2], sessionId, session);
  }
  if (action === "continue") {
    return handleContinue(interaction, sessionId, session);
  }
  if (action === "cashout") {
    return handleCashOut(interaction, sessionId, session);
  }
}

module.exports = { handleRpsComponent };
