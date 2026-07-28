const { addPoints } = require("./pointsService");
const GuildPointsConfig = require("../models/guild-points-config");

// Passive income for being in a voice channel, instead of rewarding chat
// activity - chat-based rewards would incentivize spamming messages just to
// farm points for /예측 bets, which is exactly what we don't want.
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_POINTS_PER_INTERVAL = 10;

// Node's setTimeout silently misbehaves past ~24.8 days; events are always
// meant to be short (hours/days), so this is just a safety net.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// In-memory only - re-armed from the DB on startup (see rearmVoiceEventReverts)
// so a Railway restart/redeploy doesn't lose a pending "revert to default" timer.
const scheduledReverts = new Map(); // guildId -> Timeout

async function getPointsPerInterval(guildId) {
  const config = await GuildPointsConfig.findOne({ guildId });
  if (!config || config.voicePointsPerInterval == null) return DEFAULT_POINTS_PER_INTERVAL;
  return config.voicePointsPerInterval;
}

function clearScheduledRevert(guildId) {
  const timer = scheduledReverts.get(guildId);
  if (timer) {
    clearTimeout(timer);
    scheduledReverts.delete(guildId);
  }
}

function scheduleRevert(guildId, expiresAt) {
  clearScheduledRevert(guildId);
  const delay = Math.min(Math.max(expiresAt.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
  const timer = setTimeout(() => {
    scheduledReverts.delete(guildId);
    clearVoiceEventRate(guildId).catch((err) =>
      console.error(`[points] failed to auto-revert voice event for guild ${guildId}:`, err.message)
    );
  }, delay);
  scheduledReverts.set(guildId, timer);
}

// Sets a temporary (or indefinite, if minutes is omitted) override for how many
// points get paid out per 5-minute voice tick in this guild - e.g. a "Happy
// Friday, double voice points tonight" event, without touching code or
// redeploying. Pass 0 to pause voice income entirely during the override.
async function setVoiceEventRate(guildId, pointsPerInterval, minutes) {
  const voicePointsExpiresAt = minutes ? new Date(Date.now() + minutes * 60 * 1000) : undefined;

  await GuildPointsConfig.findOneAndUpdate(
    { guildId },
    { voicePointsPerInterval: pointsPerInterval, voicePointsExpiresAt },
    { upsert: true }
  );

  clearScheduledRevert(guildId);
  if (voicePointsExpiresAt) scheduleRevert(guildId, voicePointsExpiresAt);
}

// Reverts to the default rate immediately (manual "end the event now").
async function clearVoiceEventRate(guildId) {
  clearScheduledRevert(guildId);
  await GuildPointsConfig.findOneAndUpdate(
    { guildId },
    { $unset: { voicePointsPerInterval: "", voicePointsExpiresAt: "" } }
  );
}

// Run once after the bot logs in (and mongo is connected) so a guild that had
// a timed voice-points event running when the process last stopped gets its
// revert timer re-armed - including reverting immediately if the deadline
// already passed while the bot was down.
async function rearmVoiceEventReverts() {
  try {
    const pending = await GuildPointsConfig.find({ voicePointsExpiresAt: { $ne: null } });
    for (const config of pending) {
      scheduleRevert(config.guildId, config.voicePointsExpiresAt);
    }
    if (pending.length > 0) {
      console.log(`[points] re-armed ${pending.length} pending voice-event revert(s)`);
    }
  } catch (err) {
    console.error("[points] failed to re-arm voice event reverts:", err.message);
  }
}

// Anti-AFK-farm rules:
// - AFK channel is excluded entirely (server's configured "자리비움" channel).
// - A channel with only one real member in it is excluded - joining alone and
//   tabbing out shouldn't earn anything, this only pays out while actually
//   hanging out with at least one other person.
async function awardVoicePoints(guild) {
  const pointsPerInterval = await getPointsPerInterval(guild.id);
  if (pointsPerInterval <= 0) return;

  const afkChannelId = guild.afkChannelId;

  const byChannel = new Map();
  for (const voiceState of guild.voiceStates.cache.values()) {
    const member = voiceState.member;
    const channelId = voiceState.channelId;
    if (!member || member.user.bot || !channelId) continue;
    if (afkChannelId && channelId === afkChannelId) continue;

    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.get(channelId).push(member);
  }

  for (const members of byChannel.values()) {
    if (members.length < 2) continue;
    for (const member of members) {
      await addPoints(guild.id, member.user, pointsPerInterval).catch((err) =>
        console.error(`[points] failed to award voice points to ${member.id} in guild ${guild.id}:`, err.message)
      );
    }
  }
}

function startVoicePointsInterval(client) {
  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      awardVoicePoints(guild).catch((err) =>
        console.error(`[points] voice point award failed for guild ${guild.id}:`, err.message)
      );
    }
  }, INTERVAL_MS);

  console.log(
    `[points] voice channel point interval started (default ${DEFAULT_POINTS_PER_INTERVAL} pts every ${INTERVAL_MS / 60000}min, 2+ people, AFK channel excluded)`
  );
}

module.exports = {
  startVoicePointsInterval,
  setVoiceEventRate,
  clearVoiceEventRate,
  rearmVoiceEventReverts,
  DEFAULT_POINTS_PER_INTERVAL,
};
