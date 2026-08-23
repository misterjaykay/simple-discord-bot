const { getSpeciesById, getTypeEffectivenessMultiplier } = require("./pokeApiClient");

// Effective attack/defense = real PokeAPI base stat + a per-level bonus, so a
// pet's actual species (not just its level) matters - see the design notes in
// pet/tournamentService.js. Kept small and separate from petService's leveling
// constants since these only affect /펫대전 outcomes, not feed/play pacing.
const LEVEL_ATTACK_SCALAR = 2;
const LEVEL_DEFENSE_SCALAR = 2;

// ±20% swing per roll - enough that a lower-level/weaker-stat pet can still
// pull off an upset sometimes, without making level/species irrelevant.
const VARIANCE_MIN = 0.8;
const VARIANCE_MAX = 1.2;

// Dynamic handicap: a matchup where one side is far stronger than the other
// gets pulled back toward fairness, scaled by how big THAT SPECIFIC gap is -
// a close matchup is barely touched, but a lopsided one (a maxed-out species
// vs a fresh Lv.1) gets compensated hard. This empirically beat both widening
// RNG for every match and flatly compressing every pet's stats - a single
// standout pet on the real server was winning ~99% of tournaments under those
// approaches, and only dropped to a healthy ~30% (with every other pet
// getting real title shots) once the handicap was made per-matchup instead
// of global. See the /펫대전 balance discussion this was tuned against.
const HANDICAP_GAP_FOR_FULL_STRENGTH = 0.5; // power-share gap at which the cap is reached
const MAX_HANDICAP = 0.5; // at most a 50% power swing toward the underdog

function randomVariance() {
  return VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN);
}

// A rough "how strong is this pet overall" figure used only to size the
// handicap between two specific opponents - not part of the actual combat
// math below (that still runs on the real attack/defense/type formula).
function powerScore(pet) {
  return (pet.baseAttack + pet.baseDefense) / 2 + pet.level * LEVEL_ATTACK_SCALAR;
}

// [handicapA, handicapB] multipliers for this specific matchup - whichever
// side has the higher powerScore share gets multiplied down, the other gets
// multiplied up, by the same amount, scaled by how lopsided the share is
// (capped at MAX_HANDICAP so it can't fully invert a real mismatch).
function computeHandicaps(petA, petB) {
  const scoreA = powerScore(petA);
  const scoreB = powerScore(petB);
  const total = scoreA + scoreB;
  const shareA = total > 0 ? scoreA / total : 0.5;
  const gap = Math.abs(shareA - 0.5) * 2; // 0 = even matchup, 1 = maximally lopsided
  const strength = Math.min(1, gap / HANDICAP_GAP_FOR_FULL_STRENGTH) * MAX_HANDICAP;
  const handicapA = shareA > 0.5 ? 1 - strength : 1 + strength;
  const handicapB = shareA > 0.5 ? 1 + strength : 1 - strength;
  return [handicapA, handicapB];
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

async function effectivePower(attacker, defenderTypes, handicap) {
  const typeMultiplier = await getTypeEffectivenessMultiplier(attacker.types, defenderTypes);
  const base = attacker.baseAttack + attacker.level * LEVEL_ATTACK_SCALAR;
  return base * typeMultiplier * randomVariance() * handicap;
}

function effectiveResist(defender, handicap) {
  return (defender.baseDefense + defender.level * LEVEL_DEFENSE_SCALAR) * handicap;
}

// One independent roll between two pets - not a shared "HP pool" simulation,
// just "who came out ahead this exchange" (a full turn-based sim was tested
// and rejected - more turns made the stronger pet win MORE reliably, not
// less, since per-turn variance averages out over many turns instead of
// mattering once). Returns "A" or "B" rather than a userId - a single owner
// can now enter multiple pets (see /펫대전 신청), so two entrants can share
// the same userId and a userId wouldn't tell the caller which one won.
async function resolveSingleRound(petA, petB) {
  const [handicapA, handicapB] = computeHandicaps(petA, petB);

  const [powerA, powerB] = await Promise.all([
    effectivePower(petA, petB.types, handicapA),
    effectivePower(petB, petA.types, handicapB),
  ]);
  const resistA = effectiveResist(petA, handicapA);
  const resistB = effectiveResist(petB, handicapB);

  const marginA = powerA - resistB;
  const marginB = powerB - resistA;

  if (marginA === marginB) return Math.random() < 0.5 ? "A" : "B";
  return marginA > marginB ? "A" : "B";
}

// isFinal rounds are best-of-3 (first to 2 wins); everything else is a single
// roll. Returns { winnerSide, rounds } where winnerSide/rounds entries are
// "A" (petA) or "B" (petB) - the caller maps that back to whichever entrant
// it put in the A/B slot. rounds is the per-roll list (length 1 outside the
// final, up to 3 in the final) for the bracket embed's "1R 승 / 2R 패" detail.
async function resolveMatch(petA, petB, isFinal) {
  if (!isFinal) {
    const winnerSide = await resolveSingleRound(petA, petB);
    return { winnerSide, rounds: [winnerSide] };
  }

  const rounds = [];
  let winsA = 0;
  let winsB = 0;
  while (winsA < 2 && winsB < 2) {
    const roundWinner = await resolveSingleRound(petA, petB);
    rounds.push(roundWinner);
    if (roundWinner === "A") winsA += 1;
    else winsB += 1;
  }

  return { winnerSide: winsA > winsB ? "A" : "B", rounds };
}

module.exports = { ensureBattleStats, resolveMatch };
