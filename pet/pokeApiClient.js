const axios = require("axios");

// 1~3세대 (National Dex #1-386, Kanto+Johto+Hoenn) - user-chosen range. Wider
// range means more variety but also more discard-and-retry when looking for
// an eligible base-stage species (see getRandomEvolvableBaseSpecies below);
// 386 keeps that retry cost reasonable while still tripling the Gen-1-only pool.
const POOL_MIN_ID = 1;
const POOL_MAX_ID = 386;

// How many random species we're willing to try before giving up on finding
// one that's (a) a first-stage Pokemon and (b) evolves via a plain level-up
// (no stone/trade/friendship/time-of-day conditions, since our pet system has
// no way to fulfill those). Comfortably above what's needed in practice.
const MAX_ADOPT_ATTEMPTS = 50;

// Species like Eevee only evolve via stone/trade/friendship in the real
// games - this bot has no such mechanic, so they get a synthetic "reach this
// level" requirement instead (see getAnyEvolution). Kept separate from
// getNextEvolution's real per-species min_level values.
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

// Returns { speciesId, minLevel } for the next evolution stage IF it's
// reachable by a plain level-up with no extra condition (held item, time of
// day, location, etc.) - those triggers can't be satisfied by this bot, so a
// species whose only path forward needs one of them is treated the same as
// having no further evolution. Returns null when there's no simple next stage.
async function getNextEvolution(speciesId) {
  const raw = await getRawSpecies(speciesId);
  const chain = await getEvolutionChain(raw.evolution_chain.url);
  const node = findChainNode(chain.chain, speciesId);
  if (!node) return null;

  for (const child of node.evolves_to) {
    const detail = child.evolution_details?.find((d) => {
      if (d.trigger?.name !== "level-up" || d.min_level == null) return false;
      // Reject conditional level-up evolutions (e.g. "level up while knowing
      // move X", "level up during the day") - only the plain "reach level N" kind.
      return !d.time_of_day && !d.held_item && !d.known_move && !d.location && !d.min_happiness && !d.min_beauty;
    });
    if (detail) {
      return { speciesId: extractIdFromUrl(child.species.url), minLevel: detail.min_level };
    }
  }
  return null;
}

// Fallback for species whose ONLY path forward needs a trigger this bot can't
// model (stone, trade, friendship, etc.) - Eevee's whole line lives here.
// Picks one branch at random (decided once, by the caller storing the
// result) since these often fork into several forms (Vaporeon/Jolteon/
// Flareon...), and assigns the synthetic RARE_EVOLUTION_LEVEL as a stand-in
// for "reach a respectable level" instead of the real-world condition.
async function getAnyEvolution(speciesId) {
  const raw = await getRawSpecies(speciesId);
  const chain = await getEvolutionChain(raw.evolution_chain.url);
  const node = findChainNode(chain.chain, speciesId);
  if (!node || node.evolves_to.length === 0) return null;

  const branch = node.evolves_to[Math.floor(Math.random() * node.evolves_to.length)];
  return { speciesId: extractIdFromUrl(branch.species.url), minLevel: RARE_EVOLUTION_LEVEL };
}

// Tries the strict plain-level-up path first; if there isn't one, falls back
// to the "any trigger" path (marked rare: true) so stone/trade/friendship-only
// lines aren't excluded outright, just treated as uncommon. Returns null only
// when a species truly has no further evolution at all.
async function getFollowingEvolution(speciesId) {
  const strict = await getNextEvolution(speciesId);
  if (strict) return { ...strict, rare: false };

  const any = await getAnyEvolution(speciesId);
  if (any) return { ...any, rare: true };

  return null;
}

// A species is adoptable as a starting pet only if it's a first stage
// (nothing evolves into it) AND has some evolution ahead of it - this is
// "1차 포켓몬 중 진화 가능한 것만", with rare (stone/trade/friendship-only)
// lines like Eevee allowed in but flagged so the caller can make them uncommon.
async function getEligibleBaseSpecies(id) {
  const raw = await getRawSpecies(id);
  if (raw.evolves_from_species) return null; // not a first-stage species

  return getFollowingEvolution(id);
}

async function getRandomEvolvableBaseSpecies() {
  for (let attempt = 0; attempt < MAX_ADOPT_ATTEMPTS; attempt++) {
    const id = Math.floor(Math.random() * (POOL_MAX_ID - POOL_MIN_ID + 1)) + POOL_MIN_ID;
    const evolution = await getEligibleBaseSpecies(id).catch(() => null);
    if (!evolution) continue;
    // Rare (stone/trade/friendship-only) lines get discarded and re-rolled
    // most of the time, so they show up much less often than normal lines.
    if (evolution.rare && Math.random() >= RARE_ACCEPT_PROBABILITY) continue;

    const species = await fetchSpecies(id);
    return { ...species, nextEvolution: { speciesId: evolution.speciesId, minLevel: evolution.minLevel } };
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
  getTypeEffectivenessMultiplier,
  TYPE_NAME_KO,
};
