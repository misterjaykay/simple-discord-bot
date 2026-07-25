const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("사용 가능한 명령어 목록을 보여줍니다."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("사용 가능한 명령어")
      .setColor(0x5865f2)
      .addFields(
        { name: "마니또", value: "`/참가` `/룰` `/기간` `/내마니또` `/참가자` `/귓` `/소원`" },
        { name: "생일 / MBTI", value: "`/생일추가` `/mbti`" },
        { name: "투표", value: "`/영화투표만들기` `/투표` `/투표확인` `/날짜투표` `/날짜투표확인`" },
        { name: "음악", value: "`/재생` `/스톱`" },
        { name: "보이스마스터", value: "`/보이스설정` (관리자) `/보이스채널`" },
        { name: "기타", value: "`/티어` `/서버` `/게임초대` `/kick` `/공지` (관리자)" }
      );
    return interaction.reply({ embeds: [embed] });
  },
};
