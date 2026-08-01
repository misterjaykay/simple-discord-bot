const { ChannelType, EmbedBuilder } = require("discord.js");
const { sendLog } = require("./logConfigService");
const { formatPermissionOverwriteFields } = require("./logUtils");

const CHANNEL_TYPE_LABELS = {
  [ChannelType.GuildText]: "Text channel",
  [ChannelType.GuildVoice]: "Voice channel",
  [ChannelType.GuildCategory]: "Category",
  [ChannelType.GuildAnnouncement]: "Announcement channel",
  [ChannelType.GuildStageVoice]: "Stage channel",
  [ChannelType.GuildForum]: "Forum channel",
};

function channelTypeLabel(channel) {
  return CHANNEL_TYPE_LABELS[channel.type] ?? "Channel";
}

async function logChannelCreate(channel) {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${channelTypeLabel(channel)} created`)
    .addFields({ name: "Name", value: channel.name }, { name: "Category", value: channel.parent?.name ?? "없음" }, ...formatPermissionOverwriteFields(channel))
    .setFooter({ text: `Channel ID: ${channel.id}` })
    .setTimestamp();

  await sendLog(channel.guild, "server", { embeds: [embed] });
}

async function logChannelDelete(channel) {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`${channelTypeLabel(channel)} deleted`)
    .addFields({ name: "Name", value: channel.name }, { name: "Category", value: channel.parent?.name ?? "없음" }, ...formatPermissionOverwriteFields(channel))
    .setFooter({ text: `Channel ID: ${channel.id}` })
    .setTimestamp();

  await sendLog(channel.guild, "server", { embeds: [embed] });
}

module.exports = { logChannelCreate, logChannelDelete };
