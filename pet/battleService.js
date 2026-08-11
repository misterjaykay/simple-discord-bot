const { getSpeciesById, getTypeEffectivenessMultiplier } = require("./pokeApiClient");

// Effective attack/defense = real PokeAPI base stat + a per-level bonus, so a
// pet's actual species (not just its level) matters - see the design notes in
// pet/tournamentService.js. Kept small and separate from petService's leveling
// constants since these only affect /펫대전 outcomes, not feed/play pacing.
const LEVEL_ATTACK_SCALAR = 2;
const LEVEL_DEFENSE_SCALAR = 2;

// ±15% swing per roll - enough that a lower-level/weaker-stat pet can still
// pull off an upset sometimes, without making level/species irrelevant.
const VARIANCE_MIN = 0.85;
const VARIANCE_MAX = 1.15;

function randomVariance() {
  return VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN);
}

// Backfills types/baseAttack/baseDefense for pets adopted before /펫대전
// existed (see models/pet.js). Mutates and saves in place if anything was
// missing; no-ops otherwise. Callers should await this for every participant
// right before a tournament round runs.
async function ensureBattleStats(pet) {
  if (pet.baseAttack != null && pet.baseDefense != null && pet.types?.length) return pet;

  const species = await getSpeciesById(pet.speciesId);
  pet.types = species.types;
  pet.baseAttack = species.baseAttack;
  pet.baseDefense = species.baseDefense;
  await pet.save();
  return pet;
}

async function effectivePower(attacker, defenderTypes) {
  const typeMultiplier = await getTypeEffectivenessMultiplier(attacker.types, defenderTypes);
  const base = attacker.baseAttack + attacker.level * LEVEL_ATTACK_SCALAR;
  return base * typeMultiplier * randomVariance();
}

function effectiveResist(defender) {
  return defender.baseDefense + defender.level * LEVEL_DEFENSE_SCALAR;
}

// One independent roll between two pets - not a shared "HP pool" simulation,
// just "who came out ahead this exchange" (see the design discussion in
// pet/tournamentService.js for why a full turn-based sim was deliberately
// avoided). Returns the winning pet's userId.
async function resolveSingleRound(petA, petB) {
  const [powerA, powerB] = await Promise.all([
    effectivePower(petA, petB.types),
    effectivePower(petB, petA.types),
  ]);
  const resistA = effectiveResist(petA);
  const resistB = effectiveResist(petB);

  const marginA = powerA - resistB;
  const marginB = powerB - resistA;

  if (marginA === marginB) return Math.random() < 0.5 ? petA.userId : petB.userId;
  return marginA > marginB ? petA.userId : petB.userId;
}

// isFinal rounds are best-of-3 (first to 2 wins); everything else is a single
// roll. Returns { winnerUserId, rounds } where rounds is the per-roll winner
// list (length 1 outside the final, up to 3 in the final) for the bracket
// embed to show "1R 승 / 2R 패 / 3R 승"-style detail.
async function resolveMatch(petA, petB, isFinal) {
  if (!isFinal) {
    const winnerUserId = await resolveSingleRound(petA, petB);
    return { winnerUserId, rounds: [winnerUserId] };
  }

  const rounds = [];
  let winsA = 0;
  let winsB = 0;
  while (winsA < 2 && winsB < 2) {
    const roundWinner = await resolveSingleRound(petA, petB);
    rounds.push(roundWinner);
    if (roundWinner === petA.userId) winsA += 1;
    else winsB += 1;
  }

  return { winnerUserId: winsA > winsB ? petA.userId : petB.userId, rounds };
}

module.exports = { ensureBattleStats, resolveMatch };
