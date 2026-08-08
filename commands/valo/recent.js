const { SlashCommandBuilder } = require("discord.js");
const { getRecentMatches } = require("../../valo/valoStatsService");
const { buildRecentMatchesEmbed } = require("../../valo/valoView");

module.exports = {
  data: new SlashCommandBuilder().setName("최근").setDescription("최근 5경기 기록을 봅니다."),
  async execute(interaction) {
    const entries = await getRecentMatches(5);
    return interaction.reply(buildRecentMatchesEmbed(entries));
  },
};
