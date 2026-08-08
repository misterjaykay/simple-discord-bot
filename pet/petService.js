const Pet = require("../models/pet");
const { getOrCreatePoints, addPoints } = require("../points/pointsService");
const { getRandomEvolvableBaseSpecies, getSpeciesById, getFollowingEvolution } = require("./pokeApiClient");

// Points economy note: chatPointsService/voicePointsService only ever pay
// points IN - /예측 betting was the only sink so far. These costs give people
// another reason to spend the points they've been earning.
const ADOPT_COST = 300;
const FEED_COST = 20;
const PLAY_COST = 15;

// "10번의 기회" - mobile-gacha-style reroll allowance. Cost is paid once at
// final confirmation, not per draw, so rerolling is free as long as you
// haven't used up all 10 attempts (see pet/adoptSession.js + commands/pet-adopt.js).
const MAX_ADOPT_ATTEMPTS = 10;

const FEED_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h - prevents refilling hunger nonstop
const PLAY_COOLDOWN_MS = 60 * 60 * 1000; // 1h

// Both scale with level at the same ratio as EXP_PER_LEVEL_MULTIPLIER below,
// so the actual pace (actions needed per level) never changes even though
// the raw numbers shown to players grow - see that constant's comment.
const FEED_EXP_MULTIPLIER = 15;
const PLAY_EXP_MULTIPLIER = 25;

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

// Threshold AND reward both scale linearly with level (not flat) so the exp
// pool visibly grows level over level like a normal game's would - but
// because feed/play rewards grow at the exact same rate as the threshold,
// the number of actions needed to clear any given level never changes. A
// flat threshold (tried first) paced identically but looked static/odd to
// players; this multiplier was picked by simulating against real feed/play
// cadence so a dedicated player can level a new pet in realistic time once
// multiple pets + PvP land, without leveling being trivial.
const EXP_PER_LEVEL_MULTIPLIER = 40;

function expForNextLevel(level) {
  return level * EXP_PER_LEVEL_MULTIPLIER;
}

function feedExpForLevel(level) {
  return level * FEED_EXP_MULTIPLIER;
}

function playExpForLevel(level) {
  return level * PLAY_EXP_MULTIPLIER;
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

// Deletes the user's pet outright (no partial refund of ADOPT_COST) so they
// can adopt again - re-adopting pays ADOPT_COST again since checkAdoptEligibility
// only blocks when a pet currently exists, which is the actual point sink
// here rather than charging for the release itself. Returns the deleted pet
// (for a "you gave up on Lv.N X" message) or null if they had none.
async function releasePet(guildId, userId) {
  return Pet.findOneAndDelete({ guildId, userId });
}

// Every action below returns a small { ok, reason?, ... } object instead of
// throwing, so the command layer can turn each failure reason into a
// user-friendly Korean reply without a pile of try/catch.

// Side-effect-free check, used both before starting a preview session and
// again right before actually committing one (confirmAdopt) - someone could
// adopt from another channel or drop below the cost while rerolling.
async function checkAdoptEligibility(guildId, user) {
  const existing = await getPet(guildId, user.id);
  if (existing) return { ok: false, reason: "already-have-pet" };

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < ADOPT_COST) return { ok: false, reason: "not-enough-points" };

  return { ok: true };
}

// Draws one random adoptable candidate (first-stage, evolvable - normal
// level-up lines most of the time, rare stone/trade/friendship-only lines
// like Eevee occasionally - see pokeApiClient.getRandomEvolvableBaseSpecies).
// Doesn't touch points or the DB - purely for preview/reroll.
async function drawCandidate() {
  return getRandomEvolvableBaseSpecies();
}

// Commits a previously-drawn candidate as the user's pet: re-checks
// eligibility (things may have changed since the preview started), deducts
// ADOPT_COST, and creates the Pet doc.
async function confirmAdopt(guildId, user, candidate) {
  const eligibility = await checkAdoptEligibility(guildId, user);
  if (!eligibility.ok) return eligibility;

  await addPoints(guildId, user, -ADOPT_COST);

  const now = Date.now();
  const pet = await Pet.create({
    guildId,
    userId: user.id,
    speciesId: candidate.id,
    speciesName: candidate.displayName,
    spriteUrl: candidate.spriteUrl,
    nextEvolutionId: candidate.nextEvolution.speciesId,
    nextEvolutionMinLevel: candidate.nextEvolution.minLevel,
    // Backdated by exactly one cooldown, not set to "now" - a fresh pet still
    // shows ~full hunger/happiness (only a couple % off 100), but critically
    // the cooldown has already "elapsed" so a new owner can feed/play with
    // their pet right away instead of it being stuck on cooldown for the
    // first 2h/1h as if it had just been fed/played at adoption time.
    lastFedAt: new Date(now - FEED_COOLDOWN_MS),
    lastPlayedAt: new Date(now - PLAY_COOLDOWN_MS),
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
  const leveledUp = applyExp(pet, feedExpForLevel(pet.level));
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
  const leveledUp = applyExp(pet, playExpForLevel(pet.level));
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
  checkAdoptEligibility,
  drawCandidate,
  confirmAdopt,
  getPet,
  releasePet,
  feedPet,
  playWithPet,
  getDisplayStats,
  ADOPT_COST,
  FEED_COST,
  PLAY_COST,
  FEED_COOLDOWN_MS,
  PLAY_COOLDOWN_MS,
  MAX_ADOPT_ATTEMPTS,
};
