const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const CATEGORY_LABEL = {
  report: "🚨 신고",
  suggestion: "💡 건의",
  complaint: "😠 불만",
  concern: "💭 고민",
};

const STATUS_LABEL = {
  resolved: "✅ 해결됨",
  hold: "⏸️ 보류 중",
  archived: "🗑️ 삭제됨",
};

const STATUS_COLOR = {
  pending: 0x99aab5,
  resolved: 0x57f287,
  hold: 0xfee75c,
  archived: 0xed4245,
};

// Renders a BambooPost as the mod-channel embed + 해결/보류/삭제 button row.
// Used both when a submission first arrives and after every button click, so
// the message always reflects the post's current state in the DB.
function buildBambooPostMessage(post) {
  const fields = [{ name: "작성자", value: `<@${post.authorId}> (${post.authorUsername})` }];
  if (post.targetUserId) {
    fields.push({ name: "신고 대상", value: `<@${post.targetUserId}>` });
  }
  fields.push({ name: "내용", value: post.content });

  const statusLabel = STATUS_LABEL[post.status];
  if (statusLabel) {
    fields.push({ name: "처리 상태", value: `${statusLabel}${post.reviewedBy ? ` · by <@${post.reviewedBy}>` : ""}` });
  }

  const embed = new EmbedBuilder()
    .setTitle(CATEGORY_LABEL[post.category] ?? post.category)
    .addFields(fields)
    .setColor(STATUS_COLOR[post.status] ?? STATUS_COLOR.pending)
    .setFooter({ text: `ID: ${post._id}` })
    .setTimestamp(post.createdAt);

  // resolved/archived are terminal - lock all three buttons once there. Otherwise
  // only the button matching the current status is disabled (nothing to gain by
  // re-clicking "보류" while already on hold).
  const isTerminal = post.status === "resolved" || post.status === "archived";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bamboo:resolve:${post._id}`)
      .setLabel("해결")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isTerminal || post.status === "resolved"),
    new ButtonBuilder()
      .setCustomId(`bamboo:hold:${post._id}`)
      .setLabel("보류")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isTerminal || post.status === "hold"),
    new ButtonBuilder()
      .setCustomId(`bamboo:archive:${post._id}`)
      .setLabel("삭제")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isTerminal || post.status === "archived")
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildBambooPostMessage, CATEGORY_LABEL };
