const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getQueueView } = require("../../music/musicQueueService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("대기열")
    .setDescription("현재 재생 중인 곡과 대기열을 확인합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const view = getQueueView(interaction.guild.id);
    if (!view || !view.nowPlaying) {
      return interaction.reply({ content: "재생 중인 곡이 없습니다.", ephemeral: true });
    }

    const upcoming = view.upcoming.length ? view.upcoming.map((t, i) => `${i + 1}. ${t.title}`).join("\n") : "대기 중인 곡이 없습니다.";

    return interaction.reply(`🎵 현재 재생 중: **${view.nowPlaying.title}**\n\n**대기열**\n${upcoming}`);
  },
};
