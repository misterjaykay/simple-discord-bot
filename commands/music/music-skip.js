const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { skip } = require("../../music/musicQueueService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("스킵")
    .setDescription("현재 곡을 건너뛰고 다음 곡을 재생합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const skipped = skip(interaction.guild.id);
    if (!skipped) {
      return interaction.reply({ content: "재생 중인 곡이 없습니다.", ephemeral: true });
    }
    return interaction.reply("다음 곡으로 넘어갑니다.");
  },
};
