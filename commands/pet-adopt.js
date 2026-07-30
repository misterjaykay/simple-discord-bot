const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { checkAdoptEligibility, drawCandidate, ADOPT_COST, MAX_ADOPT_ATTEMPTS } = require("../pet/petService");
const { createSession, getSession } = require("../pet/adoptSession");
const { buildPreviewMessage, buildEligibilityFailureMessage } = require("../pet/adoptView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫입양")
    .setDescription(
      `(테스트 중, 관리자 전용) 포인트 ${ADOPT_COST}로 펫을 입양합니다. 마음에 들 때까지 최대 ${MAX_ADOPT_ATTEMPTS}번 다시 뽑을 수 있어요.`
    )
    // Administrator hides the command from the slash command picker entirely
    // for non-admins (not just a runtime block) - pet feature is still being
    // tested, remove this line to open it up to everyone.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const eligibility = await checkAdoptEligibility(interaction.guild.id, interaction.user);
    if (!eligibility.ok) {
      return interaction.reply({ ...buildEligibilityFailureMessage(eligibility.reason), ephemeral: true });
    }

    await interaction.deferReply();

    let candidate;
    try {
      candidate = await drawCandidate();
    } catch (err) {
      console.error("[pet] failed to draw a candidate:", err.message);
      return interaction.editReply("입양 가능한 포켓몬을 찾지 못했어요. 잠시 후 다시 시도해주세요.");
    }

    const sessionId = createSession(interaction.guild.id, interaction.user.id, candidate);
    return interaction.editReply(buildPreviewMessage(sessionId, getSession(sessionId)));
  },
};
