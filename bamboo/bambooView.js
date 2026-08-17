const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const CATEGORY_LABEL = {
  report: "🚨 신고",
  suggestion: "💡 건의",
  complaint: "😠 불만",
  concern: "💭 고민",
};

const STATUS_LABEL = {
  resolved: "✅ 해결됨",
  inProgress: "🔧 진행중",
  hold: "⏸️ 보류 중",
  rejected: "❌ 거절됨",
  archived: "🗑️ 삭제됨", // legacy - nothing writes this status anymore, see models/bamboo-post.js
};

const STATUS_COLOR = {
  pending: 0x99aab5,
  resolved: 0x57f287,
  inProgress: 0x5865f2,
  hold: 0xfee75c,
  rejected: 0xed4245,
  archived: 0xed4245,
};

// Renders a BambooPost as the mod-channel embed + 해결/진행중/보류/거절 button row.
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

  // resolved/rejected (and legacy archived) are terminal - lock all four buttons
  // once there. Otherwise only the button matching the current status is
  // disabled (nothing to gain by re-clicking "보류" while already on hold).
  const isTerminal = post.status === "resolved" || post.status === "rejected" || post.status === "archived";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bamboo:resolve:${post._id}`)
      .setLabel("해결")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isTerminal || post.status === "resolved"),
    new ButtonBuilder()
      .setCustomId(`bamboo:progress:${post._id}`)
      .setLabel("진행중")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isTerminal || post.status === "inProgress"),
    new ButtonBuilder()
      .setCustomId(`bamboo:hold:${post._id}`)
      .setLabel("보류")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isTerminal || post.status === "hold"),
    // Opens a modal for an optional rejection reason instead of changing
    // status directly - see bamboo/componentHandler.js's showRejectModal.
    new ButtonBuilder()
      .setCustomId(`bamboo:reject-modal:${post._id}`)
      .setLabel("거절")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isTerminal)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildBambooPostMessage, CATEGORY_LABEL };
