// Ambient pet chatter - the bot proactively posting as a pet (via a per-
// channel webhook impersonating its name/sprite) instead of only replying to
// commands. Mirrors birthday/birthdayPointsService.js's "setInterval sweep +
// per-doc cooldown marker" shape; see pet/petPersonality.js for the tone/
// dialogue pools. Every trigger below reuses fields petService/tournamentService
// already maintain - no new activity-tracking system was needed.
const Pet = require("../models/pet");
const GuildPointsConfig = require("../models/guild-points-config");
const Birthday = require("../models/birthday");
const { isDispatched } = require("./petService");
const { personalityFor, pickLine, DIALOGUE } = require("./petPersonality");
const { todayString } = require("../points/pointsService");

const MIN_LEVEL = 2; // pets need to be raised a little before they start talking
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

const NEGLECT_START_DAYS = 2;
const NEGLECT_EXCLUDE_DAYS = 7;
const ALBA_NEGLECT_START_DAYS = 3;
const ALBA_NEGLECT_EXCLUDE_DAYS = 7;
// Once a category fires, don't re-fire it again until this much time has
// passed - keeps a still-true condition (e.g. still neglected) from spamming
// every sweep tick, without needing a precise "once per calendar day" clock.
const RENAG_COOLDOWN_MS = 20 * 60 * 60 * 1000;

const VOICE_GREET_CHANCE = 0.2;

const webhookCache = new Map(); // channelId -> Webhook

function daysSince(date) {
  if (!date) return Infinity;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

function daysSinceDateString(str) {
  if (!str) return Infinity;
  return daysSince(new Date(`${str}T00:00:00Z`));
}

function onCooldown(lastAt) {
  return !!lastAt && Date.now() - lastAt.getTime() < RENAG_COOLDOWN_MS;
}

function lastCaredAt(pet) {
  const times = [pet.lastFedAt, pet.lastPlayedAt].filter(Boolean).map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

async function getPetWebhook(channel) {
  const cached = webhookCache.get(channel.id);
  if (cached) return cached;

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find((w) => w.name === "펫 알림");
  if (!webhook) webhook = await channel.createWebhook({ name: "펫 알림" });

  webhookCache.set(channel.id, webhook);
  return webhook;
}

// Sends `text` impersonating `pet` (name + sprite) into the guild's
// configured pet channel. The owner is named but never actually pinged
// (allowedMentions:{parse:[]}) - same courtesy as the /펫대전 bracket embed.
async function sendPetChatter(client, pet, text) {
  const config = await GuildPointsConfig.findOne({ guildId: pet.guildId });
  if (!config?.petChannelId) return false;

  const channel = await client.channels.fetch(config.petChannelId).catch(() => null);
  if (!channel) return false;

  const webhook = await getPetWebhook(channel).catch((err) => {
    console.error("[pet-chatter] webhook setup failed:", err.message);
    return null;
  });
  if (!webhook) return false;

  const displayName = pet.nickname ?? pet.speciesName;
  await webhook
    .send({
      username: displayName,
      avatarURL: pet.spriteUrl,
      content: `<@${pet.userId}>(${displayName}) ${text}`,
      allowedMentions: { parse: [] },
    })
    .catch((err) => console.error("[pet-chatter] send failed:", err.message));
  return true;
}

// Checks this pet's categories in priority order and fires at most ONE
// message per sweep tick - stacking several at once would read as spam even
// though each condition is individually legitimate.
async function checkAndFireForPet(client, pet, birthdayUserIds) {
  const personality = personalityFor(pet);
  const currentYear = new Date().getUTCFullYear();

  // 1. Birthday - once a year, highest priority since it's the rarest/most special.
  if (birthdayUserIds.has(pet.userId) && pet.chatterBirthdayYear !== currentYear) {
    if (await sendPetChatter(client, pet, pickLine(DIALOGUE.birthday, personality))) {
      pet.chatterBirthdayYear = currentYear;
      await pet.save();
    }
    return;
  }

  // 2. Dispatch return - one-time per completed dispatch (compares against the
  // dispatchUntil value already announced, so a NEW dispatch always re-fires).
  if (pet.dispatchUntil && pet.dispatchUntil.getTime() <= Date.now()) {
    const alreadyNotified =
      pet.chatterDispatchReturnUntil && pet.chatterDispatchReturnUntil.getTime() >= pet.dispatchUntil.getTime();
    if (!alreadyNotified) {
      if (await sendPetChatter(client, pet, pickLine(DIALOGUE.dispatchReturn, personality))) {
        pet.chatterDispatchReturnUntil = pet.dispatchUntil;
        await pet.save();
      }
      return;
    }
  }

  // 3. Evolution near (1-2 levels away) / ready.
  if (pet.nextEvolutionOptions?.length && pet.nextEvolutionMinLevel != null && !onCooldown(pet.chatterEvolutionAt)) {
    const gap = pet.nextEvolutionMinLevel - pet.level;
    if (gap <= 2) {
      const pool = gap <= 0 ? DIALOGUE.evolutionReady : DIALOGUE.evolutionNear;
      if (await sendPetChatter(client, pet, pickLine(pool, personality))) {
        pet.chatterEvolutionAt = new Date();
        await pet.save();
      }
      return;
    }
  }

  const dispatched = isDispatched(pet);

  // 4. Alba neglect - dispatched pets are exempt (dispatch already counts as working).
  if (!dispatched && !onCooldown(pet.chatterAlbaNeglectAt)) {
    const gapDays = daysSinceDateString(pet.albaDate);
    if (gapDays >= ALBA_NEGLECT_START_DAYS && gapDays <= ALBA_NEGLECT_EXCLUDE_DAYS) {
      if (await sendPetChatter(client, pet, pickLine(DIALOGUE.albaNeglect, personality))) {
        pet.chatterAlbaNeglectAt = new Date();
        await pet.save();
      }
      return;
    }
  }

  // 5. Feed/play neglect - also exempt while dispatched, since a dispatched
  // pet can't be fed or played with at all (isDispatched blocks both commands).
  if (!dispatched && !onCooldown(pet.chatterNeglectAt)) {
    const gapDays = daysSince(lastCaredAt(pet));
    if (gapDays >= NEGLECT_START_DAYS && gapDays <= NEGLECT_EXCLUDE_DAYS) {
      if (await sendPetChatter(client, pet, pickLine(DIALOGUE.neglect, personality))) {
        pet.chatterNeglectAt = new Date();
        await pet.save();
      }
    }
  }
}

async function runSweep(client) {
  const configs = await GuildPointsConfig.find({ petChannelId: { $ne: null } });
  if (configs.length === 0) return;

  const today = new Date();
  const birthdayDocs = await Birthday.find({ birthday: { $ne: null } });
  const birthdayUserIds = new Set(
    birthdayDocs
      .filter((d) => d.birthday.getUTCMonth() === today.getUTCMonth() && d.birthday.getUTCDate() === today.getUTCDate())
      .map((d) => d.userId)
  );

  for (const config of configs) {
    const pets = await Pet.find({ guildId: config.guildId, level: { $gte: MIN_LEVEL } });
    for (const pet of pets) {
      await checkAndFireForPet(client, pet, birthdayUserIds).catch((err) =>
        console.error(`[pet-chatter] check failed for pet ${pet._id}:`, err.message)
      );
    }
  }
}

function startPetChatterInterval(client) {
  runSweep(client).catch((err) => console.error("[pet-chatter] initial sweep failed:", err.message));

  setInterval(() => {
    runSweep(client).catch((err) => console.error("[pet-chatter] sweep failed:", err.message));
  }, SWEEP_INTERVAL_MS);

  console.log(`[pet-chatter] sweep interval started (every ${SWEEP_INTERVAL_MS / 60000}min)`);
}

// Voice-join greeting - event-driven (see index.js's VoiceStateUpdate
// listener), not part of the sweep. 20% RNG per join, capped at once/day/pet
// so a channel with several people joining together doesn't get several
// pets greeting at once.
async function handleVoiceGreet(oldState, newState) {
  if (oldState.channelId || !newState.channelId) return; // only a fresh join, not a move/leave
  if (newState.member?.user?.bot) return;
  if (Math.random() >= VOICE_GREET_CHANCE) return;

  const guildId = newState.guild.id;
  const config = await GuildPointsConfig.findOne({ guildId });
  if (!config?.petChannelId) return;

  const today = todayString();

  const pets = await Pet.find({ guildId, userId: newState.member.id, level: { $gte: MIN_LEVEL } });
  const pet = pets.find((p) => p.chatterVoiceGreetDate !== today);
  if (!pet) return;

  const personality = personalityFor(pet);
  if (await sendPetChatter(newState.client, pet, pickLine(DIALOGUE.voiceGreet, personality))) {
    pet.chatterVoiceGreetDate = today;
    await pet.save();
  }
}

// Tournament recap - called from tournamentService.runTournament right after
// settlement, not on the sweep interval (the weekly cycle IS the schedule).
// Only three groups fire, not every entrant, to keep volume sane: this week's
// winner/runner-up, plus pets with a standing win/runner-up record who didn't
// place this week (deduped against the two above).
async function announceTournamentRecap(client, guildId, winnerPet, runnerUpPet) {
  const personality = (pet) => personalityFor(pet);

  if (winnerPet.level >= MIN_LEVEL) {
    await sendPetChatter(client, winnerPet, pickLine(DIALOGUE.tournamentWinner, personality(winnerPet)));
  }
  if (runnerUpPet.level >= MIN_LEVEL) {
    await sendPetChatter(client, runnerUpPet, pickLine(DIALOGUE.tournamentRunnerUp, personality(runnerUpPet)));
  }

  const pastChamps = await Pet.find({
    guildId,
    level: { $gte: MIN_LEVEL },
    _id: { $nin: [winnerPet._id, runnerUpPet._id] },
    $or: [{ tournamentWins: { $gt: 0 } }, { tournamentRunnerUps: { $gt: 0 } }],
  });
  for (const pet of pastChamps) {
    await sendPetChatter(client, pet, pickLine(DIALOGUE.tournamentPastChamp, personality(pet)));
  }
}

module.exports = { startPetChatterInterval, runSweep, handleVoiceGreet, announceTournamentRecap };
