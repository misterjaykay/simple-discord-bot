const { EmbedBuilder } = require("discord.js");
const BambooPost = require("../models/bamboo-post");
const BambooConfig = require("../models/bamboo-config");

const CATEGORY_LABEL = {
  report: "🚨 신고",
  suggestion: "💡 건의",
  complaint: "😠 불만",
  concern: "💭 고민",
};

async function handleBambooComponent(interaction) {
  if (!interaction.isModalSubmit()) return;

  // customId is "bamboo:submit:<category>" or, for reports, "bamboo:submit:report:<targetUserId>".
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
    const embed = new EmbedBuilder()
      .setTitle(CATEGORY_LABEL[category] ?? category)
      .addFields(
        { name: "작성자", value: `<@${post.authorId}> (${post.authorUsername})` },
        ...(targetUserId ? [{ name: "신고 대상", value: `<@${targetUserId}>` }] : []),
        { name: "내용", value: content }
      )
      .setFooter({ text: `ID: ${post._id}` })
      .setTimestamp(post.createdAt);

    await alertChannel.send({ embeds: [embed] });
  }

  const confirmMessage = alertChannel
    ? "제출되었습니다. 운영진만 확인할 수 있으며, 다른 멤버에게는 공개되지 않습니다."
    : "제출은 기록되었지만, 아직 운영진 알림 채널이 설정되지 않았습니다. 관리자에게 `/대나무숲설정`을 요청해주세요.";

  return interaction.reply({ content: confirmMessage, ephemeral: true });
}

module.exports = { handleBambooComponent };
