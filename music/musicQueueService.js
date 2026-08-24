const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");

// One entry per guild currently playing/queued. Purely in-memory by design -
// same as the old single-track /재생 behavior, a restart just drops whatever
// was playing rather than trying to resume it.
const guildStates = new Map();

function wirePlayerEvents(guildId, state) {
  // Idle fires both when a track finishes naturally AND when skip() calls
  // player.stop() - either way, the right response is "play whatever's next".
  state.player.on(AudioPlayerStatus.Idle, () => {
    playNext(guildId).catch((err) => console.error("[music] playNext failed:", err.message));
  });
  state.player.on("error", (err) => {
    console.error("[music] player error:", err.message);
    playNext(guildId).catch((err2) => console.error("[music] playNext after error failed:", err2.message));
  });
}

async function playNext(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return;

  const track = state.queue.shift();
  if (!track) {
    state.nowPlaying = null;
    state.connection.destroy();
    guildStates.delete(guildId);
    return;
  }

  state.nowPlaying = track;
  try {
    const stream = ytdl(track.url, { filter: "audioonly", highWaterMark: 1 << 25 });
    const resource = createAudioResource(stream);
    state.player.play(resource);
  } catch (err) {
    console.error("[music] failed to play track, skipping:", err.message);
    return playNext(guildId);
  }

  const channel = state.client.channels.cache.get(state.textChannelId);
  if (channel) {
    channel.send(`🎵 재생 중: **${track.title}**`).catch(() => {});
  }
}

// Adds a track to this guild's queue, joining voice + starting playback if
// nothing is playing yet. Returns { started, position } - `started` tells the
// caller whether this track began playing immediately (position 0) or is
// waiting behind others.
async function enqueue(guild, voiceChannel, textChannelId, track) {
  let state = guildStates.get(guild.id);

  if (!state) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch (err) {
      connection.destroy();
      throw err;
    }

    const player = createAudioPlayer();
    connection.subscribe(player);

    state = { connection, player, queue: [], nowPlaying: null, textChannelId, client: guild.client };
    guildStates.set(guild.id, state);
    wirePlayerEvents(guild.id, state);
  } else {
    state.textChannelId = textChannelId;
  }

  state.queue.push(track);
  if (!state.nowPlaying) {
    await playNext(guild.id);
    return { started: true, position: 0 };
  }
  return { started: false, position: state.queue.length };
}

function skip(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.nowPlaying) return false;
  state.player.stop();
  return true;
}

function pause(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.nowPlaying) return false;
  return state.player.pause();
}

function resume(guildId) {
  const state = guildStates.get(guildId);
  if (!state || !state.nowPlaying) return false;
  return state.player.unpause();
}

function stop(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return false;
  state.queue = [];
  state.connection.destroy();
  guildStates.delete(guildId);
  return true;
}

function getQueueView(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return null;
  return { nowPlaying: state.nowPlaying, upcoming: [...state.queue] };
}

module.exports = { enqueue, skip, pause, resume, stop, getQueueView };
