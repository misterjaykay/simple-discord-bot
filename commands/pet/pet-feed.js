const { SlashCommandBuilder } = require("discord.js");
const { feedPet, FEED_COST, MAX_FEEDS_PER_DAY, formatSlotChoices, dispatchRemainingDays } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫밥주기")
    .setDescription(`포인트 ${FEED_COST}를 써서 펫에게 밥을 줍니다.`)
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("밥을 줄 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

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
    return interaction.reply(`🍖 ${displayName}에게 밥을 줬어요!${levelMsg}`);
  },
};
