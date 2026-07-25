const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("소원")
    .setDescription("내 선물 소원을 등록합니다.")
    .addStringOption((opt) => opt.setName("내용").setDescription("받고 싶은 선물").setRequired(true)),
  async execute(interaction) {
    const wish = interaction.options.getString("내용");
    try {
      await db.Person.findOneAndUpdate({ userId: interaction.user.id }, { $set: { santaGift: wish } });
      return interaction.reply({ content: "당신의 소원이 등록되었습니다.", ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "등록하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
