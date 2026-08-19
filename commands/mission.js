const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getMissionStatus,
  DAILY_COMPLETE_BASE,
  WEEKLY_COMPLETE_POINTS,
  WEEKLY_EXP_BUFF_MULTIPLIER,
} = require("../points/missionService");

function check(done) {
  return done ? "✅" : "⬜";
}

module.exports = {
  data: new SlashCommandBuilder().setName("미션").setDescription("오늘/이번 주 미션 진행 상황을 확인합니다."),
  async execute(interaction) {
    const status = await getMissionStatus(interaction.guild.id, interaction.user);

    const dailyLines = [
      `${check(status.daily.feed)} 밥주기`,
      `${check(status.daily.play)} 놀아주기`,
      `${check(status.daily.alba)} 알바`,
      `${check(status.daily.checkin)} 출석체크`,
      `${check(status.daily.lottery)} 복권 긁기`,
    ].join("\n");
    const dailyFooter = status.dailyBonusClaimedToday
      ? "✅ 오늘 보너스 수령 완료"
      : `전부 완료 시 ${DAILY_COMPLETE_BASE}P + 연속완주 보너스 (현재 ${status.dailyStreak}일 연속)`;

    const weekly = status.weekly;
    const weeklyLines = [
      `${check(weekly.feed.count >= weekly.feed.target)} 밥주기 (${weekly.feed.count}/${weekly.feed.target})`,
      `${check(weekly.play.count >= weekly.play.target)} 놀아주기 (${weekly.play.count}/${weekly.play.target})`,
      `${check(weekly.alba.count >= weekly.alba.target)} 알바 (${weekly.alba.count}/${weekly.alba.target})`,
      `${check(weekly.tournament)} 대전 참가`,
      `${check(weekly.lottery.count >= weekly.lottery.target)} 복권 긁기 (${weekly.lottery.count}/${weekly.lottery.target})`,
    ].join("\n");
    const weeklyFooter = status.weeklyBonusClaimedThisWeek
      ? "✅ 이번 주 보너스 수령 완료"
      : `전부 완료 시 ${WEEKLY_COMPLETE_POINTS}P + 5일간 EXP ${WEEKLY_EXP_BUFF_MULTIPLIER}배 버프`;

    const embed = new EmbedBuilder()
      .setTitle("📋 미션")
      .addFields(
        { name: `일일 미션 (${status.dailyDone}/${status.dailyTotal})`, value: `${dailyLines}\n\n${dailyFooter}` },
        { name: `주간 미션 (${status.weeklyDone}/${status.weeklyTotal})`, value: `${weeklyLines}\n\n${weeklyFooter}` }
      )
      .setColor(0x5865f2);

    if (status.expBuffActive) {
      embed.addFields({
        name: "⚡ EXP 버프 활성 중",
        value: `밥/놀아주기 경험치 ${WEEKLY_EXP_BUFF_MULTIPLIER}배 (약 ${status.expBuffRemainingDays}일 남음)`,
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
