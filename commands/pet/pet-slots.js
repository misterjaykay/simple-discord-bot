const { SlashCommandBuilder } = require("discord.js");
const { getPets, getUnlockedSlots, getActiveSlot } = require("../../pet/petService");
const { buildSlotStatusMessage } = require("../../pet/slotView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫슬롯")
    .setDescription("펫 슬롯 현황을 확인하고, 포인트로 새 슬롯을 열거나 활성 펫을 바꿉니다."),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const [pets, unlockedSlots, activeSlot] = await Promise.all([
      getPets(interaction.guild.id, interaction.user.id),
      getUnlockedSlots(interaction.guild.id, interaction.user),
      getActiveSlot(interaction.guild.id, interaction.user),
    ]);

    return interaction.reply({ ...buildSlotStatusMessage(pets, unlockedSlots, activeSlot, interaction.user.id), ephemeral: true });
  },
};
