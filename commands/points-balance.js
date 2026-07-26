const { SlashCommandBuilder } = require("discord.js");
const { getOrCreatePoints } = require("../points/pointsService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("포인트")
    .setDescription("포인트 잔액을 확인합니다.")
    .addUserOption((opt) => opt.setName("유저").setDescription("확인할 유저 (비워두면 본인)").setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser("유저") ?? interaction.user;
    const record = await getOrCreatePoints(interaction.guild.id, target);
    const isSelf = target.id === interaction.user.id;
    const who = isSelf ? "당신의" : `${target.username}님의`;
    return interaction.reply({ content: `${who} 포인트: **${record.points.toLocaleString()}**`, ephemeral: isSelf });
  },
};
