const LogConfig = require("../models/log-config");

const LOG_TYPES = {
  voice: "voiceLogChannelId",
  message: "messageLogChannelId",
  joinLeave: "joinLeaveLogChannelId",
  server: "serverLogChannelId",
};

// In-memory set of guildIds that have message-log enabled, so messageCreate
// doesn't have to hit Mongo on every single message just to check config.
// Refreshed on boot and whenever /로그설정 changes the message-log channel.
const messageLogEnabledGuilds = new Set();

async function refreshMessageLogGuildCache() {
  const configs = await LogConfig.find({ messageLogChannelId: { $exists: true, $ne: null } }, "guildId");
  messageLogEnabledGuilds.clear();
  for (const c of configs) messageLogEnabledGuilds.add(c.guildId);
}

function isMessageLogEnabled(guildId) {
  return messageLogEnabledGuilds.has(guildId);
}

async function getLogChannel(guild, type) {
  const field = LOG_TYPES[type];
  if (!field) return null;

  const config = await LogConfig.findOne({ guildId: guild.id });
  const channelId = config?.[field];
  if (!channelId) return null;

  return guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
}

async function sendLog(guild, type, payload) {
  if (!guild) return;
  const channel = await getLogChannel(guild, type);
  if (!channel) return;
  await channel.send(payload).catch((err) => console.error(`[logging] failed to send ${type} log:`, err.message));
}

module.exports = { LOG_TYPES, getLogChannel, sendLog, refreshMessageLogGuildCache, isMessageLogEnabled };
