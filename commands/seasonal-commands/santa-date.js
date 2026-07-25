const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder().setName("기간").setDescription("마니또 시작 기간을 확인합니다."),
  async execute(interaction) {
    const startStamp = 1638381600;
    const startDate = new Date(startStamp * 1000);
    const today = new Date();

    const fullToday = `${today.getMonth() + 1}월 ${today.getDate()}일`;
    const fullStart = `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`;

    if (fullToday !== fullStart) {
      return interaction.reply(`오늘은 시작하는 날이 아닙니다.\n시작하는 날은 ${fullStart} 입니다.`);
    }
    return interaction.reply("이미 시작되었습니다. /내마니또 로 자기 상대를 확인하시면 됩니다.");
  },
};
