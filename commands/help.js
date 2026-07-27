const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("사용 가능한 명령어 목록을 보여줍니다."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("사용 가능한 명령어")
      .setColor(0x5865f2)
      .addFields(
        { name: "MBTI", value: "`/mbti`" },
        { name: "음악", value: "`/재생` `/스톱`" },
        { name: "보이스마스터", value: "`/보이스설정` (관리자) `/보이스채널`" },
        { name: "포인트 / 예측", value: "`/포인트` `/포인트순위` `/포인트관리` (관리자) `/예측`" },
        { name: "기타", value: "`/서버` `/게임초대` `/kick` `/공지` (관리자)" }
      );
    return interaction.reply({ embeds: [embed] });
  },
};
