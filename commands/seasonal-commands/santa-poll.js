const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

// Stable poll id (instead of a one-off hardcoded Discord message id) so this poll
// document can be re-seeded and reused every year without editing the command.
const DATE_POLL_ID = "santa-date-poll";

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("날짜투표")
    .setDescription("마니또 종료 날짜에 투표합니다.")
    .addIntegerOption((opt) => opt.setName("번호").setDescription("선택할 날짜 번호").setMinValue(1).setRequired(true)),
  async execute(interaction) {
    const choiceNumber = interaction.options.getInteger("번호");
    const userpick = choiceNumber - 1;

    try {
      const participant = await db.Person.findOne({ userId: interaction.user.id });
      if (!participant) {
        return interaction.reply({ content: "당신은 마니또 그룹에 속해있지 않습니다.", ephemeral: true });
      }

      const poll = await db.Poll.findOne({ pollId: DATE_POLL_ID });
      if (!poll) {
        return interaction.reply({ content: "날짜 투표가 아직 생성되지 않았습니다.", ephemeral: true });
      }
      const choice = poll.choices[userpick];
      if (!choice) {
        return interaction.reply({ content: "존재하지 않는 번호입니다.", ephemeral: true });
      }

      await db.Poll.updateOne({ pollId: DATE_POLL_ID, "choices.id": choice.id }, { $set: { "choices.$.poll": choice.poll + 1 } });

      const updated = await db.Poll.findOne({ pollId: DATE_POLL_ID });
      const result = updated.choices.map((c, i) => `${i + 1}. ${c.name} ${c.poll}`).join("\n\n");
      return interaction.reply(`\`\`\`현재 투표 결과입니다. \n${result}\n\`\`\``);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "투표하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
