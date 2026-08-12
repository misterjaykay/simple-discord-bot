const GuildPointsConfig = require("../models/guild-points-config");

// Shared entry-point guard for every pet command (see /펫채널설정). Replies and
// returns false when the guild has restricted pet commands to one channel and
// this interaction isn't in it; returns true (no reply sent) otherwise,
// including guilds that never set a restriction at all.
async function requirePetChannel(interaction) {
  const config = await GuildPointsConfig.findOne({ guildId: interaction.guild.id });
  if (!config?.petChannelId || interaction.channelId === config.petChannelId) return true;

  await interaction.reply({
    content: `펫 관련 명령어는 <#${config.petChannelId}>에서만 사용할 수 있어요.`,
    ephemeral: true,
  });
  return false;
}

module.exports = { requirePetChannel };
