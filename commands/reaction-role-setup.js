const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ReactionRole = require("../models/reaction-role");
const { parseEmojiInput, parseMessageLink } = require("../reactionRoles/reactionRoleService");

// Resolves a message link into the actual message, checked against THIS
// guild (a link from another server would otherwise let an admin bind a role
// to a message they don't control). Returns { error } or { channel, message }.
async function resolveTargetMessage(interaction, link) {
  const parsed = parseMessageLink(link);
  if (!parsed) return { error: "메시지 링크가 올바르지 않아요. 메시지에서 `메시지 링크 복사`로 가져온 링크를 붙여넣어주세요." };
  if (parsed.guildId !== interaction.guild.id) return { error: "이 서버의 메시지 링크만 사용할 수 있어요." };

  const channel = await interaction.guild.channels.fetch(parsed.channelId).catch(() => null);
  if (!channel?.isTextBased()) return { error: "그 채널을 찾을 수 없어요." };

  const message = await channel.messages.fetch(parsed.messageId).catch(() => null);
  if (!message) return { error: "그 메시지를 찾을 수 없어요." };

  return { channel, message };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("리액션역할")
    .setDescription("메시지에 특정 이모지로 반응하면 역할을 주는 기능을 설정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("추가")
        .setDescription("메시지 + 이모지 + 역할을 연결합니다. (관리자 전용)")
        .addStringOption((opt) => opt.setName("메시지링크").setDescription("대상 메시지의 링크 (메시지 링크 복사)").setRequired(true))
        .addStringOption((opt) => opt.setName("이모지").setDescription("반응할 이모지").setRequired(true))
        .addRoleOption((opt) => opt.setName("역할").setDescription("부여할 역할").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("제거")
        .setDescription("연결을 해제합니다. (관리자 전용)")
        .addStringOption((opt) => opt.setName("메시지링크").setDescription("대상 메시지의 링크").setRequired(true))
        .addStringOption((opt) => opt.setName("이모지").setDescription("해제할 이모지").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("목록").setDescription("현재 설정된 리액션 역할 목록을 봅니다. (관리자 전용)")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "목록") {
      const bindings = await ReactionRole.find({ guildId });
      if (bindings.length === 0) {
        return interaction.reply({ content: "설정된 리액션 역할이 없어요. `/리액션역할 추가`로 만들어보세요.", ephemeral: true });
      }
      const lines = bindings.map(
        (b) =>
          `${b.emojiDisplay} → <@&${b.roleId}> (https://discord.com/channels/${b.guildId}/${b.channelId}/${b.messageId})`
      );
      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }

    if (sub === "제거") {
      const link = interaction.options.getString("메시지링크", true);
      const emojiInput = interaction.options.getString("이모지", true);
      const resolved = await resolveTargetMessage(interaction, link);
      if (resolved.error) return interaction.reply({ content: resolved.error, ephemeral: true });

      const { emojiKey } = parseEmojiInput(emojiInput);
      const deleted = await ReactionRole.findOneAndDelete({ messageId: resolved.message.id, emojiKey });
      if (!deleted) return interaction.reply({ content: "그 메시지+이모지 조합으로 설정된 리액션 역할이 없어요.", ephemeral: true });

      return interaction.reply({ content: `${emojiInput} 리액션 역할 연결을 해제했어요.`, ephemeral: true });
    }

    // 추가
    const link = interaction.options.getString("메시지링크", true);
    const emojiInput = interaction.options.getString("이모지", true);
    const role = interaction.options.getRole("역할", true);

    const resolved = await resolveTargetMessage(interaction, link);
    if (resolved.error) return interaction.reply({ content: resolved.error, ephemeral: true });
    const { channel, message } = resolved;

    if (role.managed || role.id === interaction.guild.id) {
      return interaction.reply({ content: "그 역할은 지정할 수 없어요 (봇 전용 역할이거나 @everyone).", ephemeral: true });
    }

    const { emojiKey, emojiDisplay, reactTarget } = parseEmojiInput(emojiInput);

    const existing = await ReactionRole.findOne({ messageId: message.id, emojiKey });
    if (existing) {
      return interaction.reply({ content: "그 메시지의 그 이모지는 이미 다른 역할에 연결돼 있어요. 먼저 `/리액션역할 제거`로 해제해주세요.", ephemeral: true });
    }

    await ReactionRole.create({
      guildId,
      channelId: channel.id,
      messageId: message.id,
      emojiKey,
      emojiDisplay,
      roleId: role.id,
      createdBy: interaction.user.id,
    });

    try {
      await message.react(reactTarget);
    } catch (err) {
      console.error("[reaction-role-setup] failed to pre-react to message:", err.message);
    }

    return interaction.reply({
      content: `설정했어요! 이제 [이 메시지](${message.url})에 ${emojiDisplay} 리액션을 누르면 ${role}을(를) 받고, 취소하면 다시 빠져요.`,
      ephemeral: true,
    });
  },
};
