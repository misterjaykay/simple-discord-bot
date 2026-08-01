const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  deprecated: true, // 현재 사용하지 않는 명령어 — 로더에서 제외됨.
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("서버에서 유저를 추방합니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName("유저").setDescription("추방할 유저").setRequired(true))
    .addStringOption((opt) => opt.setName("사유").setDescription("추방 사유").setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getMember("유저");
    const reason = interaction.options.getString("사유") ?? "사유 없음";

    if (!target) {
      return interaction.reply({ content: "해당 유저를 서버에서 찾을 수 없습니다.", ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ content: "이 유저를 추방할 권한이 없습니다.", ephemeral: true });
    }

    await target.kick(reason);
    return interaction.reply(`${target.user.tag} 님을 추방했습니다. (사유: ${reason})`);
  },
};
