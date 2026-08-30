const { SlashCommandBuilder } = require("discord.js");
const { feedPet, feedAllPets, FEED_COST, MAX_FEEDS_PER_DAY, formatSlotChoices, dispatchRemainingDays } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");
const { sendMissionFollowUp } = require("../../points/missionService");

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

// One line per pet /펫밥주기 전체 couldn't feed, with why - reuses the exact
// reason codes feedPet already returns for the single-pet command above.
function skipReasonText(skip) {
  const name = `${skip.pet.slot}번 ${skip.pet.nickname ?? skip.pet.speciesName}`;
  if (skip.reason === "cooldown") return `${name} - 아직 배가 안 고파해요 (${formatRemaining(skip.remainingMs)} 후 가능)`;
  if (skip.reason === "dispatched") return `${name} - 파견 중 (복귀까지 약 ${dispatchRemainingDays(skip.pet)}일)`;
  if (skip.reason === "daily-limit") return `${name} - 오늘은 이미 ${MAX_FEEDS_PER_DAY}번 줬어요`;
  if (skip.reason === "not-enough-points") return `${name} - 포인트 부족`;
  return `${name} - 밥을 줄 수 없어요`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫밥주기")
    .setDescription(`포인트 ${FEED_COST}를 써서 펫에게 밥을 줍니다.`)
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("밥을 줄 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    )
    .addBooleanOption((opt) => opt.setName("전체").setDescription("보유한 모든 펫에게 한 번에 밥을 줍니다 (펫마다 개별로 비용이 들어요)")),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    if (interaction.options.getBoolean("전체")) {
      const result = await feedAllPets(interaction.guild.id, interaction.user);
      if (!result.ok) {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }

      const lines = [];
      if (result.succeeded.length > 0) {
        const names = result.succeeded
          .map((r) => `${r.pet.slot}번 ${r.pet.nickname ?? r.pet.speciesName}${r.leveledUp ? ` 🎊Lv.${r.pet.level}` : ""}`)
          .join(", ");
        lines.push(`🍖 ${result.succeeded.length}마리에게 밥을 줬어요! (${names}) - 총 ${result.succeeded.length * FEED_COST}P`);
      }
      if (result.skipped.length > 0) lines.push(result.skipped.map(skipReasonText).join("\n"));
      if (lines.length === 0) lines.push("밥을 줄 수 있는 펫이 없어요.");

      await interaction.reply(lines.join("\n"));
      return sendMissionFollowUp(interaction, result.missionResult);
    }

    const result = await feedPet(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));

    if (!result.ok) {
      if (result.reason === "no-pet") {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }
      if (result.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      if (result.reason === "no-active-pet") {
        return interaction.reply({
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(result.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫밥주기 슬롯:번호\`로 직접 지정해주세요.`,
          ephemeral: true,
        });
      }
      if (result.reason === "cooldown") {
        return interaction.reply({
          content: `아직 배가 안 고파해요. ${formatRemaining(result.remainingMs)} 후에 다시 줘보세요.`,
          ephemeral: true,
        });
      }
      if (result.reason === "dispatched") {
        return interaction.reply({
          content: `지금 파견 중이라 밥을 줄 수 없어요. (복귀까지 약 ${dispatchRemainingDays(result.pet)}일)`,
          ephemeral: true,
        });
      }
      if (result.reason === "not-enough-points") {
        return interaction.reply({ content: `포인트가 부족해요. 밥값은 **${FEED_COST}**포인트예요.`, ephemeral: true });
      }
      if (result.reason === "daily-limit") {
        return interaction.reply({
          content: `오늘은 이미 ${MAX_FEEDS_PER_DAY}번 밥을 줬어요. 내일 다시 줘보세요!`,
          ephemeral: true,
        });
      }
      return interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
    }

    const levelMsg = result.leveledUp ? ` 🎊 레벨업! 지금 Lv.${result.pet.level}` : "";
    const displayName = result.pet.nickname ?? result.pet.speciesName;
    await interaction.reply(`🍖 ${displayName}에게 밥을 줬어요!${levelMsg}`);
    await sendMissionFollowUp(interaction, result.missionResult);
  },
};
