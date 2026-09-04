const { SlashCommandBuilder } = require("discord.js");
const { doAlba, albaAllPets, formatSlotChoices, dispatchRemainingDays } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");
const { sendMissionFollowUp } = require("../../points/missionService");
const { replyEphemeral, replyPublic } = require("../../interactionReply");

// One line per pet /펫알바 전체 couldn't send out, with why - reuses the exact
// reason codes doAlba already returns for the single-pet command above.
function skipReasonText(skip) {
  const name = `${skip.pet.slot}번 ${skip.pet.nickname ?? skip.pet.speciesName}`;
  if (skip.reason === "dispatched") return `${name} - 파견 중 (복귀까지 약 ${dispatchRemainingDays(skip.pet)}일)`;
  if (skip.reason === "daily-limit") return `${name} - 오늘 이미 다녀왔어요`;
  return `${name} - 알바를 보낼 수 없어요`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫알바")
    .setDescription("펫을 하루짜리 알바에 보내고 포인트를 법니다. (하루 1회)")
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("알바를 보낼 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    )
    .addBooleanOption((opt) => opt.setName("전체").setDescription("오늘 알바 가능한 모든 펫을 한 번에 보냅니다")),
  async execute(interaction) {
    // Deferred immediately (before any DB work) - doAlba/albaAllPets chain
    // several sequential DB round-trips (pet lookup, points balance, mission
    // bookkeeping), which can blow past Discord's 3s ack window on a slow
    // connection. See interactionReply.js for why this matters.
    await interaction.deferReply({ ephemeral: true });

    if (!(await requirePetChannel(interaction))) return;

    if (interaction.options.getBoolean("전체")) {
      const result = await albaAllPets(interaction.guild.id, interaction.user);
      if (!result.ok) {
        return replyEphemeral(interaction, { content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!" });
      }

      const lines = [];
      if (result.succeeded.length > 0) {
        const totalReward = result.succeeded.reduce((sum, r) => sum + r.reward, 0);
        const details = result.succeeded
          .map((r) => `${r.pet.slot}번 ${r.pet.nickname ?? r.pet.speciesName}${r.greatSuccess ? " 🌟" : ""}: [${r.job.name}] +${r.reward}P`)
          .join("\n");
        lines.push(`💼 ${result.succeeded.length}마리가 알바를 다녀왔어요! 총 **+${totalReward}P**\n${details}`);
      }
      if (result.skipped.length > 0) lines.push(result.skipped.map(skipReasonText).join("\n"));
      if (lines.length === 0) lines.push("알바를 보낼 수 있는 펫이 없어요.");

      await replyPublic(interaction, { content: lines.join("\n") });
      return sendMissionFollowUp(interaction, result.missionResult);
    }

    const result = await doAlba(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));

    if (!result.ok) {
      if (result.reason === "no-pet") {
        return replyEphemeral(interaction, { content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!" });
      }
      if (result.reason === "slot-empty") {
        return replyEphemeral(interaction, { content: "그 슬롯엔 펫이 없어요." });
      }
      if (result.reason === "no-active-pet") {
        return replyEphemeral(interaction, {
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(result.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫알바 슬롯:번호\`로 직접 지정해주세요.`,
        });
      }
      if (result.reason === "dispatched") {
        return replyEphemeral(interaction, {
          content: `이 펫은 지금 파견 중이라 알바를 할 수 없어요. (복귀까지 약 ${dispatchRemainingDays(result.pet)}일)`,
        });
      }
      if (result.reason === "daily-limit") {
        return replyEphemeral(interaction, { content: "오늘은 이미 알바를 다녀왔어요. 내일 다시 보내주세요!" });
      }
      return replyEphemeral(interaction, { content: "오류가 발생했습니다." });
    }

    const displayName = result.pet.nickname ?? result.pet.speciesName;
    const successPrefix = result.greatSuccess ? "🌟 대성공! " : "";
    await replyPublic(interaction, {
      content: `💼 ${successPrefix}${displayName}가(이) [${result.job.name}] 알바를 다녀왔어요! ${result.job.flavor}. **+${result.reward}P** 획득!`,
    });
    await sendMissionFollowUp(interaction, result.missionResult);
  },
};
