const { SlashCommandBuilder } = require("discord.js");
const db = require("../../../models");

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("귓")
    .setDescription("내 마니또에게 익명으로 메시지를 보냅니다.")
    .addStringOption((opt) => opt.setName("내용").setDescription("보낼 메시지").setRequired(true)),
  async execute(interaction) {
    const content = interaction.options.getString("내용");
    try {
      const me = await db.Person.findOne({ userId: interaction.user.id });
      if (!me || !me.santaId) {
        return interaction.reply({ content: "마니또가 없네요? 왜지?", ephemeral: true });
      }
      const target = await interaction.client.users.fetch(me.santaId);
      await target.send(`당신의 마니또가 보낸 메세지 입니다.\`\`\`${content}\`\`\``);
      return interaction.reply({ content: "당신의 메시지가 마니또에게 전송됐습니다.", ephemeral: true });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "메시지를 보내는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
