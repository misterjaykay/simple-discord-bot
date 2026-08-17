const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const BambooPost = require("../models/bamboo-post");
const BambooConfig = require("../models/bamboo-config");
const { buildBambooPostMessage, CATEGORY_LABEL } = require("./bambooView");

// 거절 isn't here - it goes through showRejectModal/handleRejectSubmit instead
// of a direct status flip, since it needs to collect an optional reason first.
const STATUS_BY_ACTION = {
  resolve: "resolved",
  progress: "inProgress",
  hold: "hold",
};

// Best-effort DM to the original submitter - a closed-DM author should never
// block a mod from finishing their review, so failures are just logged.
async function notifyAuthor(client, post, message) {
  try {
    const author = await client.users.fetch(post.authorId);
    await author.send(message);
  } catch (err) {
    console.error("[bamboo] failed to DM author:", err.message);
  }
}

async function handleBambooComponent(interaction) {
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("bamboo:reject-submit:")) return handleRejectSubmit(interaction);
    return handleSubmit(interaction);
  }
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("bamboo:reject-modal:")) return showRejectModal(interaction);
    return handleReviewAction(interaction);
  }
}

// customId: "bamboo:submit:<category>" or, for reports, "bamboo:submit:report:<targetUserId>".
async function handleSubmit(interaction) {
  const [, , category, targetUserId] = interaction.customId.split(":");
  const content = interaction.fields.getTextInputValue("content");

  const post = await BambooPost.create({
    guildId: interaction.guild.id,
    authorId: interaction.user.id,
    authorUsername: interaction.user.tag,
    category,
    ...(targetUserId ? { targetUserId } : {}),
    content,
  });

  const config = await BambooConfig.findOne({ guildId: interaction.guild.id });
  const alertChannel = config ? await interaction.guild.channels.fetch(config.alertChannelId).catch(() => null) : null;

  if (alertChannel) {
    await alertChannel.send(buildBambooPostMessage(post));
  }

  const confirmMessage = alertChannel
    ? "제출되었습니다. 운영진만 확인할 수 있으며, 다른 멤버에게는 공개되지 않습니다."
    : "제출은 기록되었지만, 아직 운영진 알림 채널이 설정되지 않았습니다. 관리자에게 `/대나무숲설정`을 요청해주세요.";

  return interaction.reply({ content: confirmMessage, ephemeral: true });
}

// customId: "bamboo:resolve|progress|hold:<postId>" - the 해결/진행중/보류 buttons.
async function handleReviewAction(interaction) {
  const [, action, postId] = interaction.customId.split(":");
  const newStatus = STATUS_BY_ACTION[action];
  if (!newStatus) return;

  // The mod channel itself should already be locked down, but this is a cheap
  // second guard against a misconfigured channel exposing the buttons.
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "이 작업은 운영진만 할 수 있어요.", ephemeral: true });
  }

  const post = await BambooPost.findById(postId);
  if (!post) {
    return interaction.reply({ content: "이미 삭제되었거나 존재하지 않는 항목이에요.", ephemeral: true });
  }
  if (post.status === "resolved" || post.status === "rejected" || post.status === "archived") {
    return interaction.reply({ content: "이미 처리 완료된 항목이에요.", ephemeral: true });
  }

  post.status = newStatus;
  post.reviewedBy = interaction.user.id;
  post.reviewedAt = new Date();
  await post.save();

  // 해결은 처리 완료 = 더 이상 볼 필요 없음이므로 게시판에서 메시지째 지워서 채널에는
  // 미해결(대기중/진행중/보류) 건만 남게 한다. DB 기록(post)은 그대로 남아있음. 해결은
  // 운영진이 직접 패치노트 등으로 알리는 경우가 많아 DM은 따로 보내지 않는다.
  if (newStatus === "resolved") {
    await interaction.deferUpdate();
    return interaction.message.delete().catch((err) => {
      console.error("[bamboo] failed to delete reviewed post message:", err.message);
    });
  }

  // 진행중/보류는 아직 처리 중이라 채널에 남겨두고 상태만 갱신하되, 제출자에게는
  // 진행 상황을 DM으로 알려준다 (해결과 달리 별도 공지가 없는 경우가 많아서).
  const dmMessage =
    newStatus === "inProgress"
      ? `📋 대나무숲 제출(${CATEGORY_LABEL[post.category] ?? post.category})을 운영진이 확인했고, 현재 처리 중이에요.\n\n제출 내용: ${post.content}`
      : `📋 대나무숲 제출(${CATEGORY_LABEL[post.category] ?? post.category})이 보류 상태로 변경됐어요. 운영진이 조금 더 검토한 뒤 다시 안내드릴게요.\n\n제출 내용: ${post.content}`;
  await notifyAuthor(interaction.client, post, dmMessage);

  return interaction.update(buildBambooPostMessage(post));
}

// customId: "bamboo:reject-modal:<postId>" - opens the 거절 사유 modal.
async function showRejectModal(interaction) {
  const [, , postId] = interaction.customId.split(":");

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "이 작업은 운영진만 할 수 있어요.", ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId(`bamboo:reject-submit:${postId}`).setTitle("거절 사유");
  const reasonInput = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("거절 사유 (선택, 작성자에게 DM으로 전달돼요)")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return interaction.showModal(modal);
}

// customId: "bamboo:reject-submit:<postId>" - the 거절 사유 modal's submit.
async function handleRejectSubmit(interaction) {
  const [, , postId] = interaction.customId.split(":");
  const reason = interaction.fields.getTextInputValue("reason")?.trim();

  const post = await BambooPost.findById(postId);
  if (!post) {
    return interaction.reply({ content: "이미 삭제되었거나 존재하지 않는 항목이에요.", ephemeral: true });
  }
  if (post.status === "resolved" || post.status === "rejected" || post.status === "archived") {
    return interaction.reply({ content: "이미 처리 완료된 항목이에요.", ephemeral: true });
  }

  await interaction.deferUpdate();

  post.status = "rejected";
  post.rejectionReason = reason || undefined;
  post.reviewedBy = interaction.user.id;
  post.reviewedAt = new Date();
  await post.save();

  const reasonLine = reason ? `\n사유: ${reason}` : "";
  await notifyAuthor(
    interaction.client,
    post,
    `📋 대나무숲 제출(${CATEGORY_LABEL[post.category] ?? post.category})이 거절되었습니다.${reasonLine}\n\n제출 내용: ${post.content}`
  );

  return interaction.message?.delete().catch((err) => {
    console.error("[bamboo] failed to delete reviewed post message:", err.message);
  });
}

module.exports = { handleBambooComponent };
