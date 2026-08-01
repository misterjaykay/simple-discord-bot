const { EmbedBuilder } = require("discord.js");
const { sendLog, isMessageLogEnabled } = require("./logConfigService");
const MessageLogCache = require("../models/message-log-cache");

const MAX_FIELD_LENGTH = 1000;

function truncate(text) {
  if (!text) return "*(내용 없음)*";
  return text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}...` : text;
}

function cachePayload(message) {
  return {
    messageId: message.id,
    guildId: message.guild.id,
    channelId: message.channelId,
    authorId: message.author.id,
    authorTag: message.author.tag,
    content: message.content,
    createdAt: new Date(),
  };
}

// Keeps a short-lived local copy of message content (see models/message-log-cache.js)
// so edits/deletes can show "before" text - Discord's delete event never includes
// it, and this survives bot restarts unlike discord.js's in-memory message cache.
// Only guilds with message-log actually configured get written, to avoid piling
// up Mongo writes for servers that don't use the feature.
async function cacheMessage(message) {
  if (!message.guild || !message.author) return;
  if (!isMessageLogEnabled(message.guild.id)) return;

  await MessageLogCache.findOneAndUpdate({ messageId: message.id }, cachePayload(message), { upsert: true }).catch((err) =>
    console.error("[logging] failed to cache message:", err.message)
  );
}

async function logMessageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || !newMessage.author || newMessage.author.bot) return;
  if (!isMessageLogEnabled(newMessage.guild.id)) return;

  const cached = await MessageLogCache.findOne({ messageId: newMessage.id });
  const beforeContent = !oldMessage.partial ? oldMessage.content : cached?.content;

  // Non-text edits (link embeds unfurling, etc.) fire messageUpdate too - only
  // log when the visible text actually changed.
  if (beforeContent === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
    .setTitle(`Message edited in #${newMessage.channel?.name ?? "알 수 없는 채널"}`)
    .addFields({ name: "Before", value: truncate(beforeContent) }, { name: "After", value: truncate(newMessage.content) })
    .setFooter({ text: `ID: ${newMessage.id}` })
    .setTimestamp();

  await sendLog(newMessage.guild, "message", { embeds: [embed] });

  await MessageLogCache.findOneAndUpdate({ messageId: newMessage.id }, cachePayload(newMessage), { upsert: true }).catch((err) =>
    console.error("[logging] failed to refresh message cache:", err.message)
  );
}

async function logMessageDelete(message) {
  const guild = message.guild;
  if (!guild || !isMessageLogEnabled(guild.id)) return;

  const cached = await MessageLogCache.findOne({ messageId: message.id });
  const channelName = message.channel?.name ?? "알 수 없는 채널";
  const authorTag = cached?.authorTag ?? message.author?.tag ?? "알 수 없음";

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setAuthor({ name: authorTag })
    .setTitle(`Message deleted in #${channelName}`)
    .addFields({ name: "내용", value: truncate(cached?.content ?? message.content) })
    .setFooter({ text: `ID: ${message.id}` })
    .setTimestamp();

  await sendLog(guild, "message", { embeds: [embed] });
  await MessageLogCache.deleteOne({ messageId: message.id }).catch(() => {});
}

module.exports = { cacheMessage, logMessageUpdate, logMessageDelete };
