const { PermissionFlagsBits } = require("discord.js");
const BambooPost = require("../models/bamboo-post");
const BambooConfig = require("../models/bamboo-config");
const { buildBambooPostMessage } = require("./bambooView");

const STATUS_BY_ACTION = {
  resolve: "resolved",
  hold: "hold",
  archive: "archived",
};

async function handleBambooComponent(interaction) {
  if (interaction.isModalSubmit()) return handleSubmit(interaction);
  if (interaction.isButton()) return handleReviewAction(interaction);
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

// customId: "bamboo:resolve|hold|archive:<postId>" - the 해결/보류/삭제 buttons.
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
  if (post.status === "resolved" || post.status === "archived") {
    return interaction.reply({ content: "이미 처리 완료된 항목이에요.", ephemeral: true });
  }

  post.status = newStatus;
  post.reviewedBy = interaction.user.id;
  post.reviewedAt = new Date();
  await post.save();

  // 해결/삭제는 처리 완료 = 더 이상 볼 필요 없음이므로 게시판에서 메시지째 지워서
  // 채널에는 미해결(대기중/보류) 건만 남게 한다. DB 기록(post)은 그대로 남아있음.
  // 보류는 아직 처리 중이라 채널에 남겨두고 상태만 갱신한다.
  if (newStatus === "resolved" || newStatus === "archived") {
    await interaction.deferUpdate();
    return interaction.message.delete().catch((err) => {
      console.error("[bamboo] failed to delete reviewed post message:", err.message);
    });
  }

  return interaction.update(buildBambooPostMessage(post));
}

module.exports = { handleBambooComponent };
