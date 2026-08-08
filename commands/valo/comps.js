const { SlashCommandBuilder } = require("discord.js");
const { getTopCompositions } = require("../../valo/valoStatsService");
const { buildCompositionsEmbed } = require("../../valo/valoView");

module.exports = {
  data: new SlashCommandBuilder().setName("조합").setDescription("승리 횟수가 가장 많은 요원 조합 Top 5를 봅니다."),
  async execute(interaction) {
    const combos = await getTopCompositions(5);
    return interaction.reply(buildCompositionsEmbed(combos));
  },
};
