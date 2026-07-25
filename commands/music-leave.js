const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
  data: new SlashCommandBuilder().setName("스톱").setDescription("음악 재생을 멈추고 채널에서 나갑니다."),
  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      return interaction.reply({ content: "재생 중인 채널이 없습니다.", ephemeral: true });
    }
    connection.destroy();
    return interaction.reply("음악을 멈추고 채널에서 나갑니다. :D");
  },
};
