const { SlashCommandBuilder } = require("discord.js");
const { getMapStats } = require("../../valo/valoStatsService");
const { buildMapStatsEmbed } = require("../../valo/valoView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("맵")
    .setDescription("맵별 승률을 봅니다.")
    .addStringOption((opt) =>
      opt.setName("맵이름").setDescription("맵 이름 (한글/영문 둘 다 가능, 예: 어센트 또는 Ascent)").setRequired(true)
    ),
  async execute(interaction) {
    const mapStats = await getMapStats(interaction.options.getString("맵이름"));
    return interaction.reply(buildMapStatsEmbed(mapStats));
  },
};
