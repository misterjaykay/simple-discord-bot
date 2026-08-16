const { SlashCommandBuilder } = require("discord.js");
const { resolvePetForAction, formatSlotChoices, isDispatched, dispatchRemainingDays, DISPATCH_DURATIONS } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");
const { buildDispatchConfirmMessage } = require("../../pet/dispatchView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫파견")
    .setDescription("펫을 며칠간 장기 알바로 보내고 확정 포인트를 받습니다. (시작하면 되돌릴 수 없어요)")
    .addIntegerOption((opt) =>
      opt
        .setName("기간")
        .setDescription("파견 기간(일)")
        .setRequired(true)
        .addChoices(...DISPATCH_DURATIONS.map((d) => ({ name: `${d}일`, value: d })))
    )
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("파견 보낼 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const days = interaction.options.getInteger("기간", true);
    const resolved = await resolvePetForAction(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));

    if (!resolved.ok) {
      if (resolved.reason === "no-pet") {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }
      if (resolved.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      if (resolved.reason === "no-active-pet") {
        return interaction.reply({
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(resolved.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫파견 슬롯:번호\`로 직접 지정해주세요.`,
          ephemeral: true,
        });
      }
      return interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
    }

    const pet = resolved.pet;
    if (isDispatched(pet)) {
      return interaction.reply({
        content: `이미 파견 중이에요. (복귀까지 약 ${dispatchRemainingDays(pet)}일)`,
        ephemeral: true,
      });
    }

    return interaction.reply({ ...buildDispatchConfirmMessage(pet, interaction.user.id, days), ephemeral: true });
  },
};
