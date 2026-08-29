const { SlashCommandBuilder } = require("discord.js");
const { checkAdoptEligibility, drawCandidate, ADOPT_COSTS, MAX_ADOPT_ATTEMPTS } = require("../../pet/petService");
const { GENERATION_GROUPS } = require("../../pet/pokeApiClient");
const { createSession, getSession } = require("../../pet/adoptSession");
const { buildPreviewMessage, buildEligibilityFailureMessage } = require("../../pet/adoptView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

// Built dynamically from GENERATION_GROUPS/ADOPT_COSTS instead of hardcoding
// each tier, so opening a future generation only means adding an entry to
// those two objects - this file doesn't need to change again.
const generationEntries = Object.entries(GENERATION_GROUPS).map(([value, { label }]) => ({ value: Number(value), label }));
const latestGeneration = Math.max(...generationEntries.map((g) => g.value));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫입양")
    .setDescription(`포인트를 써서 펫을 입양합니다 (세대별 비용은 선택지 참고). 마음에 들 때까지 최대 ${MAX_ADOPT_ATTEMPTS}번 다시 뽑을 수 있어요.`)
    .addIntegerOption((opt) =>
      opt
        .setName("세대")
        .setDescription("입양 풀로 사용할 세대")
        .setRequired(true)
        .addChoices(
          ...generationEntries.map((g) => ({
            name: `${g.label} · ${ADOPT_COSTS[g.value]}P${g.value === latestGeneration ? " ✨NEW" : ""}`,
            value: g.value,
          }))
        )
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const generation = interaction.options.getInteger("세대");

    const eligibility = await checkAdoptEligibility(interaction.guild.id, interaction.user, generation);
    if (!eligibility.ok) {
      return interaction.reply({ ...buildEligibilityFailureMessage(eligibility.reason, eligibility.cost), ephemeral: true });
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
      candidate = await drawCandidate(generation);
    } catch (err) {
      console.error("[pet] failed to draw a candidate:", err.message);
      return interaction.editReply("입양 가능한 포켓몬을 찾지 못했어요. 잠시 후 다시 시도해주세요.");
    }

    const sessionId = createSession(interaction.guild.id, interaction.user.id, candidate, eligibility.targetSlot, generation);
    return interaction.editReply(buildPreviewMessage(sessionId, getSession(sessionId)));
  },
};
