const axios = require("axios");

// /펫입양 picks one of two National Dex pools instead of one combined range -
// group 1 is Kanto/Johto/Hoenn, group 2 is Sinnoh/Unova/Kalos. Eligible
// fraction stays roughly constant per generation (~35%), so MAX_ADOPT_ATTEMPTS
// below has plenty of headroom for either pool. Splitting instead of combining
// also keeps each pool's per-species odds close to the original single-range
// rate rather than diluting both together (see the probability discussion
// this was designed from).
const GENERATION_GROUPS = {
  1: { min: 1, max: 386, label: "1~3세대 (칸토·조호토·호연)" },
  2: { min: 387, max: 721, label: "4~6세대 (신오·하나·칼로스)" },
  3: { min: 722, max: 905, label: "7~8세대 (알로라·가라르)" },
};

// How many random species we're willing to try before giving up on finding
// one that's (a) a first-stage Pokemon and (b) evolves via a plain level-up
// (no stone/trade/friendship/time-of-day conditions, since our pet system has
// no way to fulfill those). Comfortably above what's needed in practice.
const MAX_ADOPT_ATTEMPTS = 50;

// Species like Eevee only evolve via stone/trade/friendship in the real
// games (no plain level-up trigger at all) - this bot has no such mechanic,
// so they get a synthetic "reach this level" requirement instead. Also used
// whenever a branch's siblings disagree on their real level-up number (see
// getFollowingEvolution).
const RARE_EVOLUTION_LEVEL = 20;

// Stone/trade/friendship-only evolvers (Eevee, Vulpix, Kadabra, etc.) are
// allowed into the adopt pool, but only rarely - most draws that land on one
// get discarded and re-rolled (see getRandomEvolvableBaseSpecies).
const RARE_ACCEPT_PROBABILITY = 0.15;

const speciesCache = new Map(); // id -> { id, displayName, spriteUrl, types, baseAttack, baseDefense } (display + battle data)
const rawSpeciesCache = new Map(); // id -> raw /pokemon-species/{id} response
const chainCache = new Map(); // chainId -> raw /evolution-chain/{id} response
const typeRelationsCache = new Map(); // type slug -> raw damage_relations

// Korean display names for the 18 canonical PokeAPI types - fixed set, cheaper
// to hardcode than round-trip /type/{name}?language=ko just for a label.
const TYPE_NAME_KO = {
  normal: "노말", fire: "불꽃", water: "물", electric: "전기", grass: "풀",
  ice: "얼음", fighting: "격투", poison: "독", ground: "땅", flying: "비행",
  psychic: "에스퍼", bug: "벌레", rock: "바위", ghost: "고스트", dragon: "드래곤",
  dark: "악", steel: "강철", fairy: "페어리",
};

function pickKoreanName(names, fallback) {
  const match = names?.find((n) => n.language?.name === "ko");
  return match?.name ?? fallback;
}

// PokeAPI resource URLs always end in ".../{id}/" - this pulls that id back
// out so we don't have to fetch a resource just to know its own number.
function extractIdFromUrl(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

async function fetchSpecies(id) {
  if (speciesCache.has(id)) return speciesCache.get(id);

  const [pokemonRes, speciesRes] = await Promise.all([
    axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`),
    axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);

  const englishName = pokemonRes.data.name;
  const displayName = pickKoreanName(speciesRes.data.names, englishName);
  const spriteUrl =
    pokemonRes.data.sprites?.other?.["official-artwork"]?.front_default ?? pokemonRes.data.sprites?.front_default;
  const types = pokemonRes.data.types.map((t) => t.type.name);
  const baseAttack = pokemonRes.data.stats.find((s) => s.stat.name === "attack")?.base_stat ?? 50;
  const baseDefense = pokemonRes.data.stats.find((s) => s.stat.name === "defense")?.base_stat ?? 50;

  const data = { id, displayName, spriteUrl, types, baseAttack, baseDefense };
  speciesCache.set(id, data);
  return data;
}

// Fetches (and caches) a type's damage relations from PokeAPI. Only 18 types
// exist, so this cache is fully warm after a handful of battles.
async function getTypeRelations(typeName) {
  if (typeRelationsCache.has(typeName)) return typeRelationsCache.get(typeName);
  const res = await axios.get(`https://pokeapi.co/api/v2/type/${typeName}`);
  const relations = res.data.damage_relations;
  typeRelationsCache.set(typeName, relations);
  return relations;
}

// Combined multiplier for an attacker's type(s) against a defender's type(s).
// Clamped to [0.5, 2.0] - this is a battle-flavor bonus on top of a level/stat
// formula, not a full Pokemon damage engine, so we deliberately don't let it
// swing as wildly as the real 4x/0.25x extremes.
async function getTypeEffectivenessMultiplier(attackerTypes, defenderTypes) {
  let multiplier = 1;
  for (const attackerType of attackerTypes) {
    const relations = await getTypeRelations(attackerType).catch(() => null);
    if (!relations) continue;
    for (const defenderType of defenderTypes) {
      if (relations.double_damage_to?.some((t) => t.name === defenderType)) multiplier *= 1.5;
      else if (relations.half_damage_to?.some((t) => t.name === defenderType)) multiplier *= 0.7;
      else if (relations.no_damage_to?.some((t) => t.name === defenderType)) multiplier *= 0.5;
    }
  }
  return Math.min(2.0, Math.max(0.5, multiplier));
}

async function getRawSpecies(id) {
  if (rawSpeciesCache.has(id)) return rawSpeciesCache.get(id);
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  rawSpeciesCache.set(id, res.data);
  return res.data;
}

async function getEvolutionChain(chainUrl) {
  const chainId = extractIdFromUrl(chainUrl);
  if (chainCache.has(chainId)) return chainCache.get(chainId);
  const res = await axios.get(chainUrl);
  chainCache.set(chainId, res.data);
  return res.data;
}

// Finds the node for `speciesId` anywhere in an evolution chain tree (it's
// almost always the root when called with a base species, but this stays
// correct if we ever call it with a mid-chain species too).
function findChainNode(node, speciesId) {
  if (extractIdFromUrl(node.species.url) === speciesId) return node;
  for (const child of node.evolves_to) {
    const found = findChainNode(child, speciesId);
    if (found) return found;
  }
  return null;
}

// The real "reach level N" trigger for one evolution_details entry, ignoring
// any OTHER condition attached alongside it (held item, time of day, known
// move, ...) - those can't be satisfied by this bot, so they don't count as
// a usable number even though the branch itself still gets surfaced as an
// option (see getFollowingEvolution).
function plainLevelUpMinLevel(child) {
  const detail = child.evolution_details?.find((d) => {
    if (d.trigger?.name !== "level-up" || d.min_level == null) return false;
    return !d.time_of_day && !d.held_item && !d.known_move && !d.location && !d.min_happiness && !d.min_beauty;
  });
  return detail?.min_level ?? null;
}

// Returns { options: [{speciesId, speciesName}], minLevel, rare } describing
// every next-stage species reachable from `speciesId`, or null if it's a
// final form. A single child is a normal one-path line. 2+ children (Eevee,
// but also plain level-up forks like Tyrogue/Wurmple whose branches are
// differentiated by a stat/personality value this bot can't read) are ALWAYS
// surfaced as separate options - branch count alone decides this, not trigger
// type - so /진화 can let the owner pick instead of the bot guessing for them.
// minLevel is the real shared level when every branch plain-level-ups at the
// same number; otherwise (any conditional trigger, or branches that disagree)
// it falls back to the synthetic RARE_EVOLUTION_LEVEL and rare is true.
async function getFollowingEvolution(speciesId) {
  const raw = await getRawSpecies(speciesId);
  const chain = await getEvolutionChain(raw.evolution_chain.url);
  const node = findChainNode(chain.chain, speciesId);
  if (!node || node.evolves_to.length === 0) return null;

  const children = node.evolves_to.map((child) => ({
    speciesId: extractIdFromUrl(child.species.url),
    plainLevel: plainLevelUpMinLevel(child),
  }));

  const sameLevel = children.every((c) => c.plainLevel != null && c.plainLevel === children[0].plainLevel);
  const minLevel = sameLevel ? children[0].plainLevel : RARE_EVOLUTION_LEVEL;

  const options = await Promise.all(
    children.map(async (c) => {
      const species = await fetchSpecies(c.speciesId);
      return { speciesId: c.speciesId, speciesName: species.displayName };
    })
  );

  return { options, minLevel, rare: !sameLevel };
}

// Non-legendary/mythical species that never evolve at all (Ditto, Tauros,
// Mimikyu, ...) are otherwise allowed into the adopt pool for variety (see
// getEligibleBaseSpecies below), EXCEPT this curated exception list:
//  - the 9 Ultra Beasts (793-799, 805, 806): PokeAPI doesn't flag them
//    is_legendary/is_mythical, but they're story-boss-tier in the actual
//    games, and a direct baseAttack+baseDefense check confirmed they're
//    literally the 3 highest-stat single-stage species in the entire 1-8세대
//    range (Stakataka 342, Kartana 312, Buzzwole 278 vs a ~167 pool average) -
//    letting them in at ordinary odds would make them the best possible draw
//    in the game.
//  - Shuckle (213): not an Ultra Beast, but the same stat check flagged it as
//    another top-3 outlier (10/230 atk/def split, sum 240) purely from a
//    near-maxed defense stat.
const EXCLUDED_FINAL_FORM_IDS = new Set([213, 793, 794, 795, 796, 797, 798, 799, 805, 806]);

// A species is adoptable as a starting pet if it's a first stage (nothing
// evolves into it) - normally it also needs an evolution ahead of it ("1차
// 포켓몬 중 진화 가능한 것만"), with rare (stone/trade/friendship-only) lines
// like Eevee allowed in but flagged so the caller can make them uncommon. A
// species with NO evolution at all is let in too unless it's in
// EXCLUDED_FINAL_FORM_IDS above - those adopt as permanent final forms
// (/펫정보 already renders "더 이상 진화하지 않아요" for this shape of pet).
async function getEligibleBaseSpecies(id) {
  const raw = await getRawSpecies(id);
  if (raw.evolves_from_species) return null; // not a first-stage species
  // Legendaries/mythicals don't normally evolve, so this filter is usually a
  // no-op - but PokeAPI's evolution_chain data links Phione -> Manaphy (a
  // breeding relationship in-game, not a real evolution: evolution_details
  // is empty) as if it were one, which would otherwise let this mythical
  // slip into the adopt pool as a "base-stage" species.
  if (raw.is_legendary || raw.is_mythical) return null;

  const evolution = await getFollowingEvolution(id);
  if (evolution) return evolution;
  if (EXCLUDED_FINAL_FORM_IDS.has(id)) return null;
  return { options: [], minLevel: null, rare: false };
}

async function getRandomEvolvableBaseSpecies(generationGroup) {
  const { min, max } = GENERATION_GROUPS[generationGroup] ?? GENERATION_GROUPS[1];
  for (let attempt = 0; attempt < MAX_ADOPT_ATTEMPTS; attempt++) {
    const id = Math.floor(Math.random() * (max - min + 1)) + min;
    const evolution = await getEligibleBaseSpecies(id).catch(() => null);
    if (!evolution) continue;
    // Rare (stone/trade/friendship-only) lines get discarded and re-rolled
    // most of the time, so they show up much less often than normal lines.
    if (evolution.rare && Math.random() >= RARE_ACCEPT_PROBABILITY) continue;

    const species = await fetchSpecies(id);
    return { ...species, nextEvolution: { options: evolution.options, minLevel: evolution.minLevel } };
  }
  throw new Error(`no eligible base species found in ${MAX_ADOPT_ATTEMPTS} attempts`);
}

async function getSpeciesById(id) {
  return fetchSpecies(id);
}

module.exports = {
  getRandomEvolvableBaseSpecies,
  getSpeciesById,
  getFollowingEvolution,
  GENERATION_GROUPS,
  getTypeEffectivenessMultiplier,
  TYPE_NAME_KO,
};
