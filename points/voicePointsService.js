const { addPoints } = require("./pointsService");

// Passive income for being in a voice channel, instead of rewarding chat
// activity - chat-based rewards would incentivize spamming messages just to
// farm points for /예측 bets, which is exactly what we don't want.
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const POINTS_PER_INTERVAL = 10;

// Anti-AFK-farm rules:
// - AFK channel is excluded entirely (server's configured "자리비움" channel).
// - A channel with only one real member in it is excluded - joining alone and
//   tabbing out shouldn't earn anything, this only pays out while actually
//   hanging out with at least one other person.
async function awardVoicePoints(guild) {
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
      await addPoints(guild.id, member.user, POINTS_PER_INTERVAL).catch((err) =>
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
    `[points] voice channel point interval started (${POINTS_PER_INTERVAL} pts every ${INTERVAL_MS / 60000}min, 2+ people, AFK channel excluded)`
  );
}

module.exports = { startVoicePointsInterval };
