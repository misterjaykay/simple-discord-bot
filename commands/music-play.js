const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection, entersState } = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");
const ytSearch = require("yt-search");

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
    .setDescription("음성 채널에서 음악을 재생합니다.")
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
      const searchResult = await ytSearch(query);
      const video = searchResult.videos?.[0];
      if (!video) {
        return interaction.editReply("검색 결과를 찾을 수 없습니다.");
      }
      videoUrl = video.url;
      title = video.title;
    }

    let connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
      } catch (err) {
        connection.destroy();
        console.error(err);
        return interaction.editReply("음성 채널에 연결하지 못했습니다.");
      }
    }

    try {
      const stream = ytdl(videoUrl, { filter: "audioonly", highWaterMark: 1 << 25 });
      const resource = createAudioResource(stream);
      const player = createAudioPlayer();

      player.play(resource);
      connection.subscribe(player);

      player.once(AudioPlayerStatus.Idle, () => connection.destroy());
      player.on("error", (err) => {
        console.error("Audio player error:", err);
        connection.destroy();
      });

      return interaction.editReply(`재생을 시작합니다: **${title}**`);
    } catch (err) {
      console.error(err);
      connection.destroy();
      return interaction.editReply("음악을 재생하는 중 오류가 발생했습니다.");
    }
  },
};
