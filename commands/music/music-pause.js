const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { pause } = require("../../music/musicQueueService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("일시정지")
    .setDescription("재생을 일시정지합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const paused = pause(interaction.guild.id);
    if (!paused) {
      return interaction.reply({ content: "재생 중인 곡이 없습니다.", ephemeral: true });
    }
    return interaction.reply("일시정지했습니다.");
  },
};
