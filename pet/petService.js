const Pet = require("../models/pet");
const { getOrCreatePoints, addPoints } = require("../points/pointsService");
const { getRandomEvolvableBaseSpecies, getSpeciesById, getFollowingEvolution } = require("./pokeApiClient");

// Points economy note: chatPointsService/voicePointsService only ever pay
// points IN - /예측 betting was the only sink so far. These costs give people
// another reason to spend the points they've been earning.
const ADOPT_COST = 300;
const FEED_COST = 20;
const PLAY_COST = 15;

const FEED_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h - prevents refilling hunger nonstop
const PLAY_COOLDOWN_MS = 60 * 60 * 1000; // 1h

const FEED_EXP = 10;
const PLAY_EXP = 15;

// A full stat (100) decays to 0 over this many hours since the last feed/play.
// Feeding/playing fully refills to 100 rather than adding a flat amount, so
// this alone determines how quickly a neglected pet's bars empty out.
const HUNGER_DECAY_HOURS = 48;
const HAPPINESS_DECAY_HOURS = 72;

function decayedStat(lastAt, decayHours) {
  if (!lastAt) return 0;
  const hoursElapsed = (Date.now() - lastAt.getTime()) / (60 * 60 * 1000);
  return Math.max(0, Math.round(100 - (hoursElapsed / decayHours) * 100));
}

function expForNextLevel(level) {
  return level * 100;
}

// Mutates pet.exp/pet.level in place (caller still has to .save()). Handles
// multiple level-ups in one go in case a big enough exp gain is ever added.
function applyExp(pet, amount) {
  pet.exp += amount;
  let leveledUp = false;
  while (pet.exp >= expForNextLevel(pet.level)) {
    pet.exp -= expForNextLevel(pet.level);
    pet.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

async function getPet(guildId, userId) {
  return Pet.findOne({ guildId, userId });
}

// Every action below returns a small { ok, reason?, ... } object instead of
// throwing, so the command layer can turn each failure reason into a
// user-friendly Korean reply without a pile of try/catch.

async function adoptPet(guildId, user) {
  const existing = await getPet(guildId, user.id);
  if (existing) return { ok: false, reason: "already-have-pet" };

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < ADOPT_COST) return { ok: false, reason: "not-enough-points" };

  // Only ever hands out first-stage Pokemon that have SOME evolution ahead of
  // them (see pokeApiClient.getRandomEvolvableBaseSpecies) - normal level-up
  // lines most of the time, stone/trade/friendship-only lines like Eevee only
  // rarely. No fully-evolved-only or non-evolving species in the pool.
  let species;
  try {
    species = await getRandomEvolvableBaseSpecies();
  } catch (err) {
    console.error("[pet] failed to find an adoptable species:", err.message);
    return { ok: false, reason: "no-eligible-species" };
  }

  await addPoints(guildId, user, -ADOPT_COST);

  const now = new Date();
  const pet = await Pet.create({
    guildId,
    userId: user.id,
    speciesId: species.id,
    speciesName: species.displayName,
    spriteUrl: species.spriteUrl,
    nextEvolutionId: species.nextEvolution.speciesId,
    nextEvolutionMinLevel: species.nextEvolution.minLevel,
    lastFedAt: now,
    lastPlayedAt: now,
  });

  return { ok: true, pet };
}

// Mutates pet in place (speciesId/speciesName/spriteUrl/nextEvolution*) if
// its level has reached the stored evolution threshold. Caller still needs
// to .save(). Returns { from, to } for the command layer to announce, or
// null if no evolution happened this time.
async function checkEvolution(pet) {
  if (!pet.nextEvolutionId || pet.nextEvolutionMinLevel == null) return null;
  if (pet.level < pet.nextEvolutionMinLevel) return null;

  const fromName = pet.speciesName;
  const newSpecies = await getSpeciesById(pet.nextEvolutionId);
  const newNextEvolution = await getFollowingEvolution(pet.nextEvolutionId).catch(() => null);

  pet.speciesId = pet.nextEvolutionId;
  pet.speciesName = newSpecies.displayName;
  pet.spriteUrl = newSpecies.spriteUrl;
  pet.nextEvolutionId = newNextEvolution?.speciesId ?? null;
  pet.nextEvolutionMinLevel = newNextEvolution?.minLevel ?? null;

  return { from: fromName, to: pet.speciesName };
}

async function feedPet(guildId, user) {
  const pet = await getPet(guildId, user.id);
  if (!pet) return { ok: false, reason: "no-pet" };

  const remainingMs = pet.lastFedAt ? FEED_COOLDOWN_MS - (Date.now() - pet.lastFedAt.getTime()) : 0;
  if (remainingMs > 0) return { ok: false, reason: "cooldown", remainingMs };

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < FEED_COST) return { ok: false, reason: "not-enough-points" };

  await addPoints(guildId, user, -FEED_COST);
  pet.lastFedAt = new Date();
  const leveledUp = applyExp(pet, FEED_EXP);
  const evolvedTo = leveledUp ? await checkEvolution(pet) : null;
  await pet.save();

  return { ok: true, pet, leveledUp, evolvedTo };
}

async function playWithPet(guildId, user) {
  const pet = await getPet(guildId, user.id);
  if (!pet) return { ok: false, reason: "no-pet" };

  const remainingMs = pet.lastPlayedAt ? PLAY_COOLDOWN_MS - (Date.now() - pet.lastPlayedAt.getTime()) : 0;
  if (remainingMs > 0) return { ok: false, reason: "cooldown", remainingMs };

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < PLAY_COST) return { ok: false, reason: "not-enough-points" };

  await addPoints(guildId, user, -PLAY_COST);
  pet.lastPlayedAt = new Date();
  const leveledUp = applyExp(pet, PLAY_EXP);
  const evolvedTo = leveledUp ? await checkEvolution(pet) : null;
  await pet.save();

  return { ok: true, pet, leveledUp, evolvedTo };
}

function getDisplayStats(pet) {
  return {
    hunger: decayedStat(pet.lastFedAt, HUNGER_DECAY_HOURS),
    happiness: decayedStat(pet.lastPlayedAt, HAPPINESS_DECAY_HOURS),
    expNeeded: expForNextLevel(pet.level),
  };
}

module.exports = {
  adoptPet,
  getPet,
  feedPet,
  playWithPet,
  getDisplayStats,
  ADOPT_COST,
  FEED_COST,
  PLAY_COST,
  FEED_COOLDOWN_MS,
  PLAY_COOLDOWN_MS,
};
