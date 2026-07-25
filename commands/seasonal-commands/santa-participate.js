const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder().setName("참가").setDescription("시크릿 산타 & 마니또에 참가합니다."),
  async execute(interaction) {
    const { id, username } = interaction.user;
    try {
      // Fixed: original checked for duplicates by userName, so two people who share a
      // display name (or one person rejoining under a new name) could slip through.
      const existing = await db.Person.findOne({ userId: id });
      if (existing) {
        return interaction.reply({ content: "중복 참가는 불가능합니다.", ephemeral: true });
      }
      await new db.Person({ userId: id, userName: username, userMessage: interaction.id }).save();
      return interaction.reply(`${username} 님, 참가 신청해주셔서 감사합니다.`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "참가 신청 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
