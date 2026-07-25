const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

const DATE_POLL_ID = "santa-date-poll";

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder().setName("날짜투표확인").setDescription("마니또 종료 날짜 투표 결과를 확인합니다."),
  async execute(interaction) {
    try {
      const poll = await db.Poll.findOne({ pollId: DATE_POLL_ID });
      if (!poll) {
        return interaction.reply({ content: "날짜 투표가 아직 생성되지 않았습니다.", ephemeral: true });
      }
      const result = poll.choices.map((c, i) => `${i + 1}. ${c.name} ${c.poll}표`).join("\n\n");
      return interaction.reply(`\`\`\`현재 투표 결과입니다. \n${result}\n\`\`\``);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "투표 결과를 확인하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
