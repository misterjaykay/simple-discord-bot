const { getSession, updateCandidate, deleteSession } = require("./adoptSession");
const { drawCandidate, confirmAdopt, releasePet, MAX_ADOPT_ATTEMPTS } = require("./petService");
const { buildPreviewMessage, buildAdoptedMessage, buildExpiredMessage, buildEligibilityFailureMessage } = require("./adoptView");
const { buildReleasedMessage, buildReleaseCancelledMessage, buildNoPetToReleaseMessage } = require("./releaseView");

async function handlePetComponent(interaction) {
  const [, action, sessionId] = interaction.customId.split(":");

  // 파양 confirm/cancel aren't tied to a multi-step session like adopt is -
  // the customId just carries whichever userId's confirmation this is.
  if (action === "releaseConfirm" || action === "releaseCancel") {
    const ownerUserId = sessionId;
    if (interaction.user.id !== ownerUserId) {
      return interaction.reply({ content: "본인이 실행한 파양만 조작할 수 있어요.", ephemeral: true });
    }

    if (action === "releaseCancel") {
      return interaction.update(buildReleaseCancelledMessage());
    }

    const released = await releasePet(interaction.guild.id, interaction.user.id);
    if (!released) {
      return interaction.update(buildNoPetToReleaseMessage());
    }
    return interaction.update(buildReleasedMessage(released));
  }

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
    // Can go null if a double-click raced this session past its final reroll
    // (or its own expiry) between the ownership check above and here.
    if (!updated) {
      return interaction.editReply(buildExpiredMessage());
    }

    // Last attempt - some users were just leaving the final preview sitting
    // there without ever clicking 확정, so instead of waiting for one more
    // click, the 10th reroll adopts that candidate right away.
    if (updated.attemptsUsed >= MAX_ADOPT_ATTEMPTS) {
      deleteSession(sessionId);
      const result = await confirmAdopt(session.guildId, interaction.user, candidate);

      if (!result.ok) {
        return interaction.editReply(buildEligibilityFailureMessage(result.reason));
      }
      return interaction.editReply(buildAdoptedMessage(result.pet));
    }

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
