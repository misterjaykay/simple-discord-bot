const { getSession, updateCandidate, deleteSession } = require("./adoptSession");
const {
  drawCandidate,
  confirmAdopt,
  releasePet,
  unlockNextSlot,
  setActiveSlot,
  evolvePet,
  getPets,
  getUnlockedSlots,
  getActiveSlot,
  MAX_ADOPT_ATTEMPTS,
} = require("./petService");
const {
  buildPreviewMessage,
  buildAdoptedMessage,
  buildPublicAdoptedMessage,
  buildExpiredMessage,
  buildEligibilityFailureMessage,
} = require("./adoptView");
const { buildReleasedMessage, buildReleaseCancelledMessage, buildNoPetToReleaseMessage } = require("./releaseView");
const { buildSlotStatusMessage } = require("./slotView");
const { buildEvolvedMessage, buildEvolveFailureMessage } = require("./evolveView");

async function handlePetComponent(interaction) {
  const [, action, sessionId, extra] = interaction.customId.split(":");

  // 파양 confirm/cancel aren't tied to a multi-step session like adopt is -
  // the customId just carries whichever userId + slot this confirmation is for.
  if (action === "releaseConfirm" || action === "releaseCancel") {
    const ownerUserId = sessionId;
    const slot = Number(extra);
    if (interaction.user.id !== ownerUserId) {
      return interaction.reply({ content: "본인이 실행한 파양만 조작할 수 있어요.", ephemeral: true });
    }

    if (action === "releaseCancel") {
      return interaction.update(buildReleaseCancelledMessage());
    }

    const released = await releasePet(interaction.guild.id, interaction.user.id, slot);
    if (!released) {
      return interaction.update(buildNoPetToReleaseMessage());
    }
    return interaction.update(buildReleasedMessage(released));
  }

  // Same customId-only pattern as release - no session needed since the cost
  // and target slot are already fully determined by the time the button shows.
  if (action === "unlockSlot") {
    const ownerUserId = sessionId;
    if (interaction.user.id !== ownerUserId) {
      return interaction.reply({ content: "본인만 조작할 수 있어요.", ephemeral: true });
    }

    const result = await unlockNextSlot(interaction.guild.id, interaction.user);
    if (!result.ok) {
      const msg =
        result.reason === "maxed"
          ? "이미 모든 슬롯을 열었어요!"
          : `포인트가 부족해요. ${result.nextSlot}번 슬롯은 ${result.cost.toLocaleString()}포인트가 필요해요.`;
      return interaction.reply({ content: msg, ephemeral: true });
    }

    const [pets, unlockedSlots, activeSlot] = await Promise.all([
      getPets(interaction.guild.id, interaction.user.id),
      getUnlockedSlots(interaction.guild.id, interaction.user),
      getActiveSlot(interaction.guild.id, interaction.user),
    ]);
    return interaction.update(
      buildSlotStatusMessage(
        pets,
        unlockedSlots,
        activeSlot,
        interaction.user.id,
        `🔓 ${result.slot}번 슬롯을 열었어요! (${result.cost.toLocaleString()}P 사용)`
      )
    );
  }

  // Same customId-only pattern - switches which slot 슬롯-less feed/play/rename/
  // release act on (see petService.resolvePetForAction).
  if (action === "activateSlot") {
    const ownerUserId = sessionId;
    const slot = Number(extra);
    if (interaction.user.id !== ownerUserId) {
      return interaction.reply({ content: "본인만 조작할 수 있어요.", ephemeral: true });
    }

    const result = await setActiveSlot(interaction.guild.id, interaction.user, slot);
    if (!result.ok) {
      return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
    }

    const [pets, unlockedSlots] = await Promise.all([
      getPets(interaction.guild.id, interaction.user.id),
      getUnlockedSlots(interaction.guild.id, interaction.user),
    ]);
    return interaction.update(
      buildSlotStatusMessage(
        pets,
        unlockedSlots,
        slot,
        interaction.user.id,
        `🎯 ${result.pet.nickname ?? result.pet.speciesName}(${slot}번 슬롯)을(를) 활성 펫으로 지정했어요!`
      )
    );
  }

  // Same customId-only pattern as release/slot actions - the options
  // themselves already live on the Pet doc, so no session is needed. slot
  // pins down exactly which pet this select menu was built for.
  if (action === "evolveChoice") {
    const ownerUserId = sessionId;
    const slot = Number(extra);
    if (interaction.user.id !== ownerUserId) {
      return interaction.reply({ content: "본인이 실행한 진화만 조작할 수 있어요.", ephemeral: true });
    }

    const chosenSpeciesId = Number(interaction.values[0]);
    const result = await evolvePet(interaction.guild.id, interaction.user, slot, chosenSpeciesId);
    if (!result.ok) {
      return interaction.update(buildEvolveFailureMessage(result.reason));
    }
    return interaction.update(buildEvolvedMessage(result));
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
      await interaction.editReply(buildAdoptedMessage(result.pet));
      await interaction.channel
        .send(buildPublicAdoptedMessage(interaction.user, result.pet))
        .catch((err) => console.error("[pet] public adopt announcement failed:", err.message));
      return;
    }

    return interaction.editReply(buildPreviewMessage(sessionId, updated));
  }

  if (action === "confirm") {
    deleteSession(sessionId);
    const result = await confirmAdopt(session.guildId, interaction.user, session.candidate);

    if (!result.ok) {
      return interaction.update(buildEligibilityFailureMessage(result.reason));
    }

    await interaction.update(buildAdoptedMessage(result.pet));
    await interaction.channel
      .send(buildPublicAdoptedMessage(interaction.user, result.pet))
      .catch((err) => console.error("[pet] public adopt announcement failed:", err.message));
    return;
  }
}

module.exports = { handlePetComponent };
