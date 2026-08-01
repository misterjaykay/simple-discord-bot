const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getAttendanceStats } = require("../../points/checkinService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("출석률")
    .setDescription("출석 기록을 확인합니다.")
    .addUserOption((opt) => opt.setName("유저").setDescription("확인할 유저 (비워두면 본인)").setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser("유저") ?? interaction.user;
    const stats = await getAttendanceStats(interaction.guild.id, target);
    const isSelf = target.id === interaction.user.id;
    const who = isSelf ? "당신의" : `${target.username}님의`;

    if (stats.rate === null) {
      return interaction.reply({
        content: `${who} 출석 기록이 아직 없어요. \`/출석\`으로 시작해보세요!`,
        ephemeral: isSelf,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📅 ${who} 출석 현황`)
      .addFields(
        { name: "총 출석일수", value: `${stats.totalCheckins}일`, inline: true },
        { name: "연속 출석", value: `${stats.streak}일`, inline: true },
        { name: "출석률", value: `${stats.rate}% (${stats.daysTracked}일 중)`, inline: true }
      )
      .setColor(0x2ecc71);

    return interaction.reply({ embeds: [embed] });
  },
};
