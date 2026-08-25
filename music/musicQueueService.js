const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const { spawn } = require("node:child_process");

// One entry per guild currently playing/queued. Purely in-memory by design -
// same as the old single-track /재생 behavior, a restart just drops whatever
// was playing rather than trying to resume it.
const guildStates = new Map();

function announce(state, message) {
  const channel = state.client.channels.cache.get(state.textChannelId);
  if (channel) channel.send(message).catch(() => {});
}

// yt-dlp instead of ytdl-core: YouTube's current bot-detection ("Sign in to
// confirm you're not a bot") blocks ytdl-core even with valid session
// cookies - it now often wants a browser-derived proof-of-origin token that
// ytdl-core can't produce. yt-dlp handles this itself and is patched within
// days whenever YouTube changes something, unlike JS extraction libraries.
// Streams audio straight to stdout rather than writing a temp file.
function spawnYtDlp(url) {
  // bestaudio alone 404s on videos with no audio-only stream (common lately) -
  // /best falls back to a combined video+audio stream, which createAudioResource
  // still demuxes down to just the audio track just fine.
  const proc = spawn("yt-dlp", [url, "-f", "bestaudio/best", "-o", "-", "--no-playlist", "--quiet", "--no-warnings"]);
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  proc.on("close", (code) => {
    if (code !== 0 && code !== null) console.error(`[music] yt-dlp exited with code ${code}: ${stderr.slice(0, 500)}`);
  });
  return proc;
}

function killCurrentProcess(state) {
  // A skipped/stopped track's yt-dlp process doesn't stop on its own just
  // because nothing's reading its stdout anymore - it has to be killed
  // explicitly, or it keeps running in the background wasting resources.
  if (state.currentProcess && state.currentProcess.exitCode === null) {
    state.currentProcess.kill();
  }
  state.currentProcess = null;
}

function wirePlayerEvents(guildId, state) {
  // Idle fires both when a track finishes naturally AND when skip() calls
  // player.stop() - either way, the right response is "play whatever's next".
  state.player.on(AudioPlayerStatus.Idle, () => {
    playNext(guildId).catch((err) => console.error("[music] playNext failed:", err.message));
  });
  state.player.on("error", (err) => {
    // A failed track fires this mid-playback (bad stream, YouTube blocked the
    // request, etc.) - without announcing it, this looks identical to the
    // queue just running out and the bot silently leaving.
    console.error("[music] player error:", err.message);
    const failedTrack = state.nowPlaying;
    if (failedTrack) announce(state, `⚠️ **${failedTrack.title}** 재생 중 오류가 발생해 건너뜁니다. (${err.message})`);
    playNext(guildId).catch((err2) => console.error("[music] playNext after error failed:", err2.message));
  });
}

async function playNext(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return;

  killCurrentProcess(state);

  const track = state.queue.shift();
  if (!track) {
    state.nowPlaying = null;
    state.connection.destroy();
    guildStates.delete(guildId);
    return;
  }

  state.nowPlaying = track;
  try {
    const proc = spawnYtDlp(track.url);
    state.currentProcess = proc;
    const resource = createAudioResource(proc.stdout);
    state.player.play(resource);
  } catch (err) {
    // Same reasoning as the player "error" handler above - surface it instead
    // of silently moving on, otherwise a broken link just looks like nothing
    // happened.
    console.error("[music] failed to play track, skipping:", err.message);
    announce(state, `⚠️ **${track.title}** 재생에 실패해 건너뜁니다. (${err.message})`);
    return playNext(guildId);
  }

  announce(state, `🎵 재생 중: **${track.title}**`);
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

    state = { connection, player, queue: [], nowPlaying: null, currentProcess: null, textChannelId, client: guild.client };
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
  killCurrentProcess(state);
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
