const { SlashCommandBuilder } = require("discord.js");
const { getAgentStats } = require("../../valo/valoStatsService");
const { buildAgentStatsEmbed } = require("../../valo/valoView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("요원")
    .setDescription("요원별 승률/KDA를 봅니다.")
    .addStringOption((opt) =>
      opt.setName("요원이름").setDescription("요원 이름 (한글/영문 둘 다 가능, 예: 제트 또는 Jett)").setRequired(true)
    ),
  async execute(interaction) {
    const agentStats = await getAgentStats(interaction.options.getString("요원이름"));
    return interaction.reply(buildAgentStatsEmbed(agentStats));
  },
};
