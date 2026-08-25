const ReactionRole = require("../models/reaction-role");

const CUSTOM_EMOJI_PATTERN = /^<a?:(\w+):(\d+)>$/;

// Discord.js reaction.emoji.id is the custom-emoji snowflake (stable) or
// null for unicode (where .name is the literal character) - matches how
// message.react() and reaction.emoji both key custom emoji, so a binding
// saved from one lines up with reactions read back from the other.
function keyForDiscordEmoji(emoji) {
  return emoji.id ?? emoji.name;
}

// Parses whatever an admin typed/pasted into the /리액션역할 추가 "이모지"
// option - either a raw unicode emoji or a custom emoji in Discord's
// <:name:id> / <a:name:id> form (what you get when you insert one from the
// emoji picker inside a slash command's text input).
function parseEmojiInput(input) {
  const match = input.match(CUSTOM_EMOJI_PATTERN);
  if (match) {
    const [, , id] = match;
    return { emojiKey: id, emojiDisplay: input, reactTarget: id };
  }
  return { emojiKey: input, emojiDisplay: input, reactTarget: input };
}

// discord.com/channels/<guildId>/<channelId>/<messageId> - the link you get
// from a message's "메시지 링크 복사" context menu action.
function parseMessageLink(link) {
  const match = link.match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  const [, guildId, channelId, messageId] = match;
  return { guildId, channelId, messageId };
}

async function handleReactionChange(reaction, user, action) {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
  } catch (err) {
    console.error("[reaction-role] failed to fetch partial reaction:", err.message);
    return;
  }

  const binding = await ReactionRole.findOne({
    messageId: reaction.message.id,
    emojiKey: keyForDiscordEmoji(reaction.emoji),
  });
  if (!binding) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const method = action === "add" ? "add" : "remove";
  await member.roles[method](binding.roleId).catch((err) =>
    console.error(`[reaction-role] failed to ${method} role ${binding.roleId} for ${user.id}:`, err.message)
  );
}

function handleReactionAdd(reaction, user) {
  return handleReactionChange(reaction, user, "add");
}

function handleReactionRemove(reaction, user) {
  return handleReactionChange(reaction, user, "remove");
}

module.exports = {
  keyForDiscordEmoji,
  parseEmojiInput,
  parseMessageLink,
  handleReactionAdd,
  handleReactionRemove,
};
