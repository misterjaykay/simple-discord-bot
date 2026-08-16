const { SlashCommandBuilder } = require("discord.js");
const { doAlba, formatSlotChoices, dispatchRemainingDays } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫알바")
    .setDescription("펫을 하루짜리 알바에 보내고 포인트를 법니다. (하루 1회)")
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("알바를 보낼 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const result = await doAlba(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));

    if (!result.ok) {
      if (result.reason === "no-pet") {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }
      if (result.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      if (result.reason === "no-active-pet") {
        return interaction.reply({
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(result.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫알바 슬롯:번호\`로 직접 지정해주세요.`,
          ephemeral: true,
        });
      }
      if (result.reason === "dispatched") {
        return interaction.reply({
          content: `이 펫은 지금 파견 중이라 알바를 할 수 없어요. (복귀까지 약 ${dispatchRemainingDays(result.pet)}일)`,
          ephemeral: true,
        });
      }
      if (result.reason === "daily-limit") {
        return interaction.reply({ content: "오늘은 이미 알바를 다녀왔어요. 내일 다시 보내주세요!", ephemeral: true });
      }
      return interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
    }

    const displayName = result.pet.nickname ?? result.pet.speciesName;
    return interaction.reply(
      `💼 ${displayName}가(이) [${result.job.name}] 알바를 다녀왔어요! ${result.job.flavor}. **+${result.reward}P** 획득!`
    );
  },
};
