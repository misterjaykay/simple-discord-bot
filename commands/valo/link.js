const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { linkPlayer, unlinkPlayer, listLinks } = require("../../valo/valoLinkService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("발로연동")
    .setDescription("발로란트 트래커 닉네임과 디스코드 유저를 연동합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("연결")
        .setDescription("닉네임과 디스코드 유저를 연동합니다.")
        .addStringOption((opt) => opt.setName("닉네임").setDescription("발로란트 트래커 닉네임").setRequired(true))
        .addUserOption((opt) => opt.setName("유저").setDescription("연동할 디스코드 유저").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("해제")
        .setDescription("연동을 해제합니다.")
        .addStringOption((opt) => opt.setName("닉네임").setDescription("닉네임으로 찾기").setRequired(false))
        .addUserOption((opt) => opt.setName("유저").setDescription("유저로 찾기").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("목록").setDescription("현재 연동된 목록을 봅니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "연결") {
      const nickname = interaction.options.getString("닉네임");
      const user = interaction.options.getUser("유저");
      try {
        const player = await linkPlayer(nickname, user.id);
        return interaction.reply({ content: `${user}님을 "${player.name}"에 연동했어요.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: err.message, ephemeral: true });
      }
    }

    if (sub === "해제") {
      const nickname = interaction.options.getString("닉네임");
      const user = interaction.options.getUser("유저");
      if (!nickname && !user) {
        return interaction.reply({ content: "닉네임 또는 유저 중 하나는 입력해주세요.", ephemeral: true });
      }
      try {
        const player = await unlinkPlayer({ nickname, discordUserId: user?.id });
        return interaction.reply({ content: `"${player.name}" 연동을 해제했어요.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: err.message, ephemeral: true });
      }
    }

    if (sub === "목록") {
      const players = await listLinks();
      if (players.length === 0) {
        return interaction.reply({ content: "연동된 플레이어가 없어요.", ephemeral: true });
      }
      const lines = players.map((p) => `${p.name} - <@${p.discordUserId}>`);
      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }
  },
};
