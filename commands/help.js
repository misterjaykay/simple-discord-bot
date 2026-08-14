const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("사용 가능한 명령어 목록을 보여줍니다."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("사용 가능한 명령어")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "포인트 획득",
          value: "`/출석` `/출석률` `/복권 긁기` `/복권 추첨 ...` `/가위바위보`",
        },
        { name: "포인트 확인 / 관리", value: "`/포인트` `/포인트순위` `/포인트선물` `/포인트관리` (관리자)" },
        { name: "예측", value: "`/예측` `/예측제재` (모더레이터)" },
        {
          name: "펫",
          value: "`/펫입양` `/펫정보` `/펫밥주기` `/펫놀아주기` `/펫이름변경` `/펫파양` `/펫대전 ...` `/펫채널설정` (관리자)",
        },
        { name: "음악", value: "`/재생` `/스톱`" },
        { name: "보이스마스터", value: "`/보이스설정` (관리자) `/보이스채널`" },
        {
          name: "발로란트 트래커",
          value: "`/승률` `/조합` `/최근` `/맵` `/요원` `/발로연동` (관리자)",
        },
        { name: "생일 / 로그 / 기타", value: "`/생일추가` `/로그설정` (관리자) `/게임초대`" },
        { name: "대나무숲 (익명 제보함)", value: "`/대나무숲` `/대나무숲설정` (관리자)" }
      );
    return interaction.reply({ embeds: [embed] });
  },
};
