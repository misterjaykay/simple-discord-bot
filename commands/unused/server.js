const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  deprecated: true, // 현재 사용하지 않는 명령어 — 로더에서 제외됨.
  data: new SlashCommandBuilder().setName("서버").setDescription("서버 정보를 보여줍니다."),
  async execute(interaction) {
    return interaction.reply(`해당 서버의 이름은 ${interaction.guild.name}\n현재 참여인원수는 ${interaction.guild.memberCount}명입니다.`);
  },
};
