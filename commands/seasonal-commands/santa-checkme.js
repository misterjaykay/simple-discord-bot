const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder().setName("내마니또").setDescription("내 마니또 상대를 DM으로 확인합니다."),
  async execute(interaction) {
    const { id } = interaction.user;
    try {
      const me = await db.Person.findOne({ userId: id });
      if (!me || !me.santaId) {
        return interaction.reply({ content: "당신의 마니또는 아직 배정되지 않았습니다.", ephemeral: true });
      }
      const target = await db.Person.findOne({ userId: me.santaId });
      if (!target) {
        return interaction.reply({ content: "당신의 마니또는 아직 배정되지 않았습니다.", ephemeral: true });
      }
      await interaction.user.send(
        `당신의 마니또는\n\`\`\`${target.userName}\`\`\`마니또의 소원은\n\`\`\`${target.santaGift ?? "없습니다"}\`\`\`입니다.`
      );
      return interaction.reply({ content: "귓속말로 보내드렸습니다.", ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "확인하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
