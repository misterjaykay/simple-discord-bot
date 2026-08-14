const { SlashCommandBuilder } = require("discord.js");
const { checkAdoptEligibility, drawCandidate, ADOPT_COST, MAX_ADOPT_ATTEMPTS } = require("../../pet/petService");
const { createSession, getSession } = require("../../pet/adoptSession");
const { buildPreviewMessage, buildEligibilityFailureMessage } = require("../../pet/adoptView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫입양")
    .setDescription(
      `포인트 ${ADOPT_COST}로 펫을 입양합니다. 마음에 들 때까지 최대 ${MAX_ADOPT_ATTEMPTS}번 다시 뽑을 수 있어요.`
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const eligibility = await checkAdoptEligibility(interaction.guild.id, interaction.user);
    if (!eligibility.ok) {
      return interaction.reply({ ...buildEligibilityFailureMessage(eligibility.reason), ephemeral: true });
    }

    // Ephemeral - the whole preview/reroll picker is private to the adopter.
    // Anyone else could technically see a public message's buttons and click
    // them (componentHandler.js already rejects non-owners), but keeping it
    // private avoids that confusion entirely. The pet only gets announced
    // publicly once adoption is actually finalized (confirm or the forced
    // 10th-reroll auto-confirm) - see pet/componentHandler.js.
    await interaction.deferReply({ ephemeral: true });

    let candidate;
    try {
      candidate = await drawCandidate();
    } catch (err) {
      console.error("[pet] failed to draw a candidate:", err.message);
      return interaction.editReply("입양 가능한 포켓몬을 찾지 못했어요. 잠시 후 다시 시도해주세요.");
    }

    const sessionId = createSession(interaction.guild.id, interaction.user.id, candidate, eligibility.targetSlot);
    return interaction.editReply(buildPreviewMessage(sessionId, getSession(sessionId)));
  },
};
