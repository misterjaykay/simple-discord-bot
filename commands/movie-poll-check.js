const { SlashCommandBuilder } = require("discord.js");
const db = require("../models");

module.exports = {
  deprecated: true, // Old movie-poll command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("투표확인")
    .setDescription("영화 투표 결과를 확인합니다.")
    .addStringOption((opt) => opt.setName("투표아이디").setDescription("/영화투표만들기 로 받은 투표 ID").setRequired(true)),
  async execute(interaction) {
    const pollId = interaction.options.getString("투표아이디");
    try {
      const poll = await db.Poll.findOne({ pollId });
      if (!poll) {
        return interaction.reply({ content: "해당 투표를 찾을 수 없습니다.", ephemeral: true });
      }
      const result = poll.choices.map((c, i) => `${i + 1}. ${c.name}: ${c.poll}`).join("\n");
      return interaction.reply(`현재 투표 결과입니다.\n\`\`\`${result}\`\`\``);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "투표 결과를 확인하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
