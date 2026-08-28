const { getSpeciesById, getTypeEffectivenessMultiplier } = require("./pokeApiClient");

// A pet's overall strength = real PokeAPI base stat average + a per-level
// bonus, so both species choice AND how much it's been leveled matter - see
// the design notes in pet/tournamentService.js. Kept small and separate from
// petService's leveling constants since this only affects /펫대전 outcomes,
// not feed/play pacing.
const LEVEL_ATTACK_SCALAR = 2;

// Win probability is powerScore-share based (see winProbability), clamped to
// this range so no matchup is ever a coin-flip-proof lock. The previous
// design (independent noisy power/resist margins + a per-matchup handicap
// patch) was replaced because it barely tracked real stats at all - measured
// across the live roster, stat strength correlated with tournament win rate
// at only ~0.1 (Pearson). This direct powerScore-ratio model measured ~0.87
// on the same roster: leveling/evolving a pet actually pays off, while the
// clamp still keeps every matchup winnable. See the /펫대전 balance
// discussion + simulation this was tuned against.
const WIN_PROB_FLOOR = 0.25;
const WIN_PROB_CEILING = 0.75;

// Species base stat average + a level bonus - level counts twice over
// (directly here, and indirectly since higher-level pets have usually
// evolved into a stronger species), which matches how leveling actually
// works in this bot rather than double-counting a bug.
function powerScore(pet) {
  return (pet.baseAttack + pet.baseDefense) / 2 + pet.level * LEVEL_ATTACK_SCALAR;
}

// P(A beats B) this matchup, folding in the real type-effectiveness
// multiplier on each side's rating before comparing shares. Clamped to
// [WIN_PROB_FLOOR, WIN_PROB_CEILING] so even a maxed-out species vs a fresh
// Lv.1 stays winnable for the underdog.
async function winProbability(petA, petB) {
  const [multA, multB] = await Promise.all([
    getTypeEffectivenessMultiplier(petA.types, petB.types),
    getTypeEffectivenessMultiplier(petB.types, petA.types),
  ]);
  const ratingA = powerScore(petA) * multA;
  const ratingB = powerScore(petB) * multB;
  const raw = ratingA / (ratingA + ratingB);
  return Math.min(WIN_PROB_CEILING, Math.max(WIN_PROB_FLOOR, raw));
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

// One independent roll between two pets - not a shared "HP pool" simulation,
// just "who came out ahead this exchange" (a full turn-based sim was tested
// and rejected - more turns made the stronger pet win MORE reliably, not
// less, since per-turn variance averages out over many turns instead of
// mattering once). Returns "A" or "B" rather than a userId - a single owner
// can now enter multiple pets (see /펫대전 신청), so two entrants can share
// the same userId and a userId wouldn't tell the caller which one won.
async function resolveSingleRound(petA, petB) {
  const winProbA = await winProbability(petA, petB);
  return Math.random() < winProbA ? "A" : "B";
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
