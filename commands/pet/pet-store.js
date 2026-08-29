const { SlashCommandBuilder } = require("discord.js");
const { resolvePetForAction, storePet, isDispatched, dispatchRemainingDays, MAX_STORAGE, formatSlotChoices } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫보관")
    .setDescription("펫을 파양하지 않고 보관함에 넣어둡니다. (다시 꺼낼 수 있어요)")
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("보관할 펫의 활성 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const resolved = await resolvePetForAction(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));
    if (!resolved.ok) {
      if (resolved.reason === "no-active-pet") {
        return interaction.reply({
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(resolved.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫보관 슬롯:번호\`로 직접 지정해주세요.`,
          ephemeral: true,
        });
      }
      if (resolved.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 먼저 입양해보세요!", ephemeral: true });
    }
    if (isDispatched(resolved.pet)) {
      return interaction.reply({
        content: `이 펫은 파견 중이라 보관할 수 없어요. (복귀까지 약 ${dispatchRemainingDays(resolved.pet)}일)`,
        ephemeral: true,
      });
    }

    const result = await storePet(interaction.guild.id, interaction.user.id, resolved.pet.slot);
    if (!result.ok) {
      const msg = result.reason === "storage-full" ? `보관함이 가득 찼어요. (최대 ${MAX_STORAGE}마리)` : "보관에 실패했어요.";
      return interaction.reply({ content: msg, ephemeral: true });
    }

    const name = result.pet.nickname ?? result.pet.speciesName;
    return interaction.reply(`📦 ${name}을(를) 보관함 ${result.pet.storageSlot}번 칸에 넣어뒀어요. 그 슬롯엔 새 펫을 입양할 수 있어요.`);
  },
};
