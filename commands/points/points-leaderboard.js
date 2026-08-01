const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboard } = require("../../points/pointsService");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("포인트순위")
    .setDescription("포인트 TOP 10 순위를 봅니다."),

  async execute(interaction) {
    const top = await getLeaderboard(interaction.guild.id, 10);

    if (top.length === 0) {
      return interaction.reply({ content: "아직 아무도 포인트 기록이 없어요.", ephemeral: true });
    }

    const lines = top.map((record, i) => {
      const rank = MEDALS[i] ?? `${i + 1}.`;
      return `${rank} <@${record.userId}> - ${record.points.toLocaleString()} 포인트`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 포인트 순위 TOP 10")
      .setDescription(lines.join("\n"))
      .setColor(0xf1c40f);

    return interaction.reply({ embeds: [embed] });
  },
};
