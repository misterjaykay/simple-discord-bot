const { SlashCommandBuilder } = require("discord.js");
const { setActiveSlot } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫활성화")
    .setDescription("슬롯을 지정하지 않은 밥주기/놀아주기/이름변경/파양이 적용될 활성 펫을 지정합니다.")
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("활성화할 펫의 슬롯").setMinValue(1).setMaxValue(3).setRequired(true)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const slot = interaction.options.getInteger("슬롯");
    const result = await setActiveSlot(interaction.guild.id, interaction.user, slot);
    if (!result.ok) {
      return interaction.reply({ content: "그 슬롯엔 펫이 없어요. `/펫슬롯`으로 확인해보세요.", ephemeral: true });
    }

    return interaction.reply({
      content: `🎯 ${result.pet.nickname ?? result.pet.speciesName}(${slot}번 슬롯)을(를) 활성 펫으로 지정했어요! 이제 슬롯을 지정하지 않은 밥주기/놀아주기는 이 펫한테 적용돼요.`,
      ephemeral: true,
    });
  },
};
