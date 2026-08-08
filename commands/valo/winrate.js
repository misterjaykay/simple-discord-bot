const { SlashCommandBuilder } = require("discord.js");
const { resolvePlayer, getPlayerStats } = require("../../valo/valoStatsService");
const { buildPlayerStatsEmbed } = require("../../valo/valoView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("승률")
    .setDescription("발로란트 플레이어의 승률/KDA를 봅니다.")
    .addStringOption((opt) => opt.setName("닉네임").setDescription("발로란트 트래커 닉네임").setRequired(false))
    .addUserOption((opt) => opt.setName("유저").setDescription("연동된 디스코드 유저 (/발로연동으로 연동)").setRequired(false)),

  async execute(interaction) {
    const nickname = interaction.options.getString("닉네임");
    const discordUser = interaction.options.getUser("유저");

    if (!nickname && !discordUser) {
      return interaction.reply({ content: "닉네임 또는 유저 중 하나는 입력해주세요.", ephemeral: true });
    }

    const player = await resolvePlayer({ nickname, discordUserId: discordUser?.id });
    if (!player) {
      return interaction.reply({
        content: discordUser ? `${discordUser}님은 아직 발로 계정이 연동되지 않았어요. (\`/발로연동\`)` : `"${nickname}" 닉네임을 찾을 수 없어요.`,
        ephemeral: true,
      });
    }

    const stats = await getPlayerStats(player);
    return interaction.reply(buildPlayerStatsEmbed(player, stats));
  },
};
