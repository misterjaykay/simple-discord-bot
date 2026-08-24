const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { resume } = require("../../music/musicQueueService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("재개")
    .setDescription("일시정지한 음악을 다시 재생합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const resumed = resume(interaction.guild.id);
    if (!resumed) {
      return interaction.reply({ content: "일시정지 중인 곡이 없습니다.", ephemeral: true });
    }
    return interaction.reply("다시 재생합니다.");
  },
};
