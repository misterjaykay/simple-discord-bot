const { getSession, updateCandidate, deleteSession } = require("./adoptSession");
const { drawCandidate, confirmAdopt, MAX_ADOPT_ATTEMPTS } = require("./petService");
const { buildPreviewMessage, buildAdoptedMessage, buildExpiredMessage, buildEligibilityFailureMessage } = require("./adoptView");

async function handlePetComponent(interaction) {
  const [, action, sessionId] = interaction.customId.split(":");
  const session = getSession(sessionId);

  if (!session) {
    return interaction.update(buildExpiredMessage());
  }
  if (session.userId !== interaction.user.id) {
    return interaction.reply({ content: "본인이 시작한 입양만 조작할 수 있어요.", ephemeral: true });
  }

  if (action === "reroll") {
    if (session.attemptsUsed >= MAX_ADOPT_ATTEMPTS) {
      return interaction.reply({ content: "더 이상 다시 뽑을 수 없어요. 지금 후보로 확정해주세요!", ephemeral: true });
    }

    await interaction.deferUpdate();
    let candidate;
    try {
      candidate = await drawCandidate();
    } catch (err) {
      console.error("[pet] reroll draw failed:", err.message);
      return interaction.followUp({ content: "다시 뽑는 중 오류가 발생했어요. 한 번 더 시도해주세요.", ephemeral: true });
    }

    const updated = updateCandidate(sessionId, candidate);
    return interaction.editReply(buildPreviewMessage(sessionId, updated));
  }

  if (action === "confirm") {
    deleteSession(sessionId);
    const result = await confirmAdopt(session.guildId, interaction.user, session.candidate);

    if (!result.ok) {
      return interaction.update(buildEligibilityFailureMessage(result.reason));
    }

    return interaction.update(buildAdoptedMessage(result.pet));
  }
}

module.exports = { handlePetComponent };
