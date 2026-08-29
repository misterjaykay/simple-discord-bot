const { SlashCommandBuilder } = require("discord.js");
const { getStorage, retrievePet, MAX_STORAGE } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫꺼내기")
    .setDescription("보관함의 펫을 활성 슬롯으로 꺼냅니다.")
    .addIntegerOption((opt) =>
      opt.setName("보관슬롯").setDescription("꺼낼 펫의 보관함 칸 번호").setMinValue(1).setMaxValue(MAX_STORAGE).setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("꺼낼 활성 슬롯 (생략하면 빈 슬롯에 자동 배정)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const storageSlot = interaction.options.getInteger("보관슬롯");
    const targetSlot = interaction.options.getInteger("슬롯");

    const result = await retrievePet(interaction.guild.id, interaction.user, storageSlot, targetSlot);
    if (!result.ok) {
      if (result.reason === "storage-empty") {
        const stored = await getStorage(interaction.guild.id, interaction.user.id);
        const hint = stored.length
          ? `보관함에 있는 칸: ${stored.map((p) => p.storageSlot).join(", ")}`
          : "보관함이 비어있어요.";
        return interaction.reply({ content: `그 보관함 칸엔 펫이 없어요. ${hint}`, ephemeral: true });
      }
      if (result.reason === "slots-full") {
        return interaction.reply({ content: "열려있는 활성 슬롯이 모두 찼어요! `/펫슬롯`으로 슬롯을 더 열거나 다른 펫을 보관해주세요.", ephemeral: true });
      }
      if (result.reason === "slot-taken") {
        return interaction.reply({ content: "그 활성 슬롯엔 이미 다른 펫이 있어요.", ephemeral: true });
      }
      if (result.reason === "slot-locked") {
        return interaction.reply({ content: "그 슬롯은 아직 열리지 않았어요. `/펫슬롯`으로 먼저 열어주세요.", ephemeral: true });
      }
      return interaction.reply({ content: "꺼내기에 실패했어요.", ephemeral: true });
    }

    const name = result.pet.nickname ?? result.pet.speciesName;
    return interaction.reply(`✨ ${name}을(를) 보관함에서 꺼내 ${result.pet.slot}번 슬롯에 배정했어요!`);
  },
};
