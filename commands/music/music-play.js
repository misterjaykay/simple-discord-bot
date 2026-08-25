const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { enqueue } = require("../../music/musicQueueService");
const { searchYoutube } = require("../../music/musicSearchService");

const isUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("재생")
    .setDescription("음성 채널에서 음악을 재생합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("검색어").setDescription("유튜브 링크 또는 검색어").setRequired(true)),
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: "먼저 음성 채널에 입장해주세요.", ephemeral: true });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return interaction.reply({ content: "이 채널에서 음성 재생 권한이 없습니다.", ephemeral: true });
    }

    const query = interaction.options.getString("검색어");
    await interaction.deferReply();

    let videoUrl = query;
    let title = "요청하신 링크";

    if (!isUrl(query)) {
      let video;
      try {
        video = await searchYoutube(query);
      } catch (err) {
        console.error("[music] search failed:", err.message);
        return interaction.editReply("검색 중 오류가 발생했습니다.");
      }
      if (!video) {
        return interaction.editReply("검색 결과를 찾을 수 없습니다.");
      }
      videoUrl = video.url;
      title = video.title;
    }

    try {
      const result = await enqueue(interaction.guild, voiceChannel, interaction.channelId, {
        url: videoUrl,
        title,
        requestedBy: interaction.user.id,
      });
      return interaction.editReply(
        result.started ? `재생을 시작합니다: **${title}**` : `대기열에 추가했습니다: **${title}** (${result.position}번째)`
      );
    } catch (err) {
      console.error(err);
      return interaction.editReply("음악을 재생하는 중 오류가 발생했습니다.");
    }
  },
};
