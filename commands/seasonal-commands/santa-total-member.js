const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder().setName("참가자").setDescription("현재 마니또 참가자 수와 명단을 확인합니다."),
  async execute(interaction) {
    try {
      const people = await db.Person.find({});
      if (people.length === 0) {
        return interaction.reply("현재 참가자수는 0명 입니다. 얼른 참가하세요!");
      }
      const names = people.map((p) => `${p.userName}님`).join(", ");
      return interaction.reply(`현재 참가자수는 ${people.length}명 입니다.\n현재 참가자 명단: ${names}`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "참가자를 확인하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
