const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { stop } = require("../../music/musicQueueService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("스톱")
    .setDescription("음악 재생을 멈추고 채널에서 나갑니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const stopped = stop(interaction.guild.id);
    if (!stopped) {
      return interaction.reply({ content: "재생 중인 채널이 없습니다.", ephemeral: true });
    }
    return interaction.reply("음악을 멈추고 채널에서 나갑니다. :D");
  },
};
