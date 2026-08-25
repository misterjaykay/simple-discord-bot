const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One binding = one (message, emoji) pair granting one role. Multiple
// bindings can share the same messageId (different emoji -> different roles
// on the same message, e.g. a self-assign board) or be the sole binding on a
// message (e.g. a rules post with a single OK reaction) - see
// reactionRoles/reactionRoleService.js and commands/reaction-role-setup.js.
const reactionRoleSchema = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  // Unicode emoji stored as the literal character (e.g. "✅"); custom guild
  // emoji stored as its snowflake id instead, since a custom emoji's name
  // isn't guaranteed stable/unique the way its id is. This is what
  // reactionRoleService actually matches incoming reactions against.
  emojiKey: { type: String, required: true },
  // The original emoji text (e.g. "✅" or "<:ok:123456789012345678>"), kept
  // only so /리액션역할 목록 can show something readable back to admins.
  emojiDisplay: { type: String, required: true },
  roleId: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

reactionRoleSchema.index({ messageId: 1, emojiKey: 1 }, { unique: true });

module.exports = mongoose.model("ReactionRole", reactionRoleSchema);
