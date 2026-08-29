const Pet = require("../models/pet");
const { getOrCreatePoints, addPoints, todayString } = require("../points/pointsService");
const { getRandomEvolvableBaseSpecies, getSpeciesById, getFollowingEvolution } = require("./pokeApiClient");
const { addToHouseBank } = require("../points/houseBankService");
const { addToPetTournamentBonusBank } = require("../points/petTournamentBonusBankService");
const { ensureBattleStats } = require("./battleService");
const missionService = require("../points/missionService");

// Points economy note: chatPointsService/voicePointsService only ever pay
// points IN - /예측 betting was the only sink so far. These costs give people
// another reason to spend the points they've been earning.
// Per-generation adopt price (see GENERATION_GROUPS in pokeApiClient.js) -
// a balance/marketing knob, not tied 1:1 to how many generations are in each
// pool.
const ADOPT_COSTS = { 1: 250, 2: 250, 3: 300 };
const FEED_COST = 30;
const PLAY_COST = 25;
// Higher than feed/play since evolving is a one-off milestone, not a routine
// action - roughly 2x feed, well above what a single feed/play cycle earns.
const EVOLVE_COST = 80;

// Pet slots: slot 1 is free for everyone (see UserPoints.petSlotsUnlocked
// default), slots 2/3 must be bought once via /펫슬롯 - costs step up per slot
// since a 2nd/3rd pet is a bigger economy sink than the first.
const MAX_SLOTS = 3;
const SLOT_UNLOCK_COSTS = { 2: 3000, 3: 4000 };

// Free storage box (/펫보관, /펫꺼내기, /펫보관함) - lets an owner park a pet
// outside the paid active slots instead of releasing it outright. A stored
// pet is fully inert (no feed/play/level/battle), so it doesn't erode the
// active slots' value ("how many can I run at once") - it only affects
// collection size, which was already unlimited in practice via
// release-and-readopt. No unlock cost, unlike MAX_SLOTS.
const MAX_STORAGE = 5;

// Half of every feed/play cost funds the weekly /펫대전 prize pool, the other
// half goes to the shared house bank - neither just vanishes anymore (see
// points/petTournamentBonusBankService.js and points/houseBankService.js).
async function routeActionCost(guildId, cost) {
  const toBonus = Math.round(cost * 0.5);
  const toHouse = cost - toBonus;
  await Promise.all([addToPetTournamentBonusBank(guildId, toBonus), addToHouseBank(guildId, toHouse)]);
}

// /펫알바 job pool - one flavor entry per PokeAPI type (keyed by the same
// English slug stored in pet.types) plus 2 type-agnostic jobs everyone can
// draw. Which one a given /펫알바 call lands on is decided by pickJob's
// weighted RNG below, not shown as a menu - see the "관심 끌기" design
// discussion this was built for (showing all candidates just makes players
// always click whichever pays best, so the game rolls instead).
const JOB_POOL = {
  normal: { name: "방범대 알바", flavor: "동네를 순찰하며 방범 활동을 도왔다" },
  fire: { name: "대장간 알바", flavor: "대장간에서 열심히 불을 지폈다" },
  water: { name: "수족관 알바", flavor: "수족관에서 관람객들을 즐겁게 해줬다" },
  electric: { name: "발전소 알바", flavor: "발전소 점검을 도왔다" },
  grass: { name: "농장 알바", flavor: "농장에서 열심히 일손을 도왔다" },
  ice: { name: "빙수가게 알바", flavor: "빙수가게에서 얼음을 갈았다" },
  fighting: { name: "체육관 알바", flavor: "체육관에서 트레이너의 훈련을 보조했다" },
  poison: { name: "방역업체 알바", flavor: "해충 방역 작업을 도왔다" },
  ground: { name: "채굴 알바", flavor: "채굴 현장에서 땀을 흘렸다" },
  flying: { name: "택배기사 알바", flavor: "하늘을 날아 택배를 배달했다" },
  psychic: { name: "타로가게 알바", flavor: "타로가게에서 손님의 운세를 봐줬다" },
  bug: { name: "양봉장 알바", flavor: "양봉장에서 꿀을 모았다" },
  rock: { name: "채석장 알바", flavor: "채석장에서 돌을 캤다" },
  ghost: { name: "방탈출카페 알바", flavor: "방탈출카페에서 손님들을 깜짝 놀래켰다" },
  dragon: { name: "놀이공원 마스코트 알바", flavor: "놀이공원에서 마스코트로 인기를 끌었다" },
  dark: { name: "심야 편의점 알바", flavor: "심야 편의점에서 야간 근무를 했다" },
  steel: { name: "공장 알바", flavor: "공장 조립라인에서 부품을 조립했다" },
  fairy: { name: "웨딩홀 알바", flavor: "웨딩홀에서 하객들을 맞이했다" },
};

const GENERIC_JOBS = [
  { name: "전단지 알바", flavor: "길거리에서 전단지를 돌렸다" },
  { name: "물류센터 알바", flavor: "물류센터에서 택배 상하차를 도왔다" },
];

// Share of the daily draw given to the pet's own matched type job(s)
// (combined - split evenly if the pet has 2+ types), the rest split evenly
// across GENERIC_JOBS. A pet with no type match yet (legacy pet before
// ensureBattleStats backfills it) just falls back to generic-only odds.
const ALBA_TYPE_JOB_WEIGHT = 45;

const ALBA_REWARD_MIN = 45;
const ALBA_REWARD_MAX = 75;

// Only rollable when pickJob() lands on the pet's OWN type job (see
// ALBA_TYPE_JOB_WEIGHT) - expressed as a share of ALL /펫알바 runs (not just
// type-match ones) so the intent stays correct even if ALBA_TYPE_JOB_WEIGHT
// gets rebalanced later; the conditional roll chance is derived from it below.
// Multiplier (not a flat bonus) so it keeps scaling correctly if
// ALBA_REWARD_MIN/MAX ever get rebalanced too.
const ALBA_GREAT_SUCCESS_OVERALL_CHANCE = 0.12;
const ALBA_GREAT_SUCCESS_CHANCE = ALBA_GREAT_SUCCESS_OVERALL_CHANCE / (ALBA_TYPE_JOB_WEIGHT / 100);
const ALBA_GREAT_SUCCESS_MULTIPLIER = 1.5;

// Dispatch (/펫파견) trades away the daily roll's upside and the "show up and
// see what happens" fun for a flat guaranteed payout you don't have to log in
// for - priced below manual alba's average so parking every pet on permanent
// dispatch never beats actually playing (see the balance discussion this was
// tuned from).
const DISPATCH_DISCOUNT = 0.7;
const DISPATCH_DURATIONS = [3, 5, 7];
const DISPATCH_DAILY_RATE = Math.round(((ALBA_REWARD_MIN + ALBA_REWARD_MAX) / 2) * DISPATCH_DISCOUNT);

// Weighted-random job for this pet's daily /펫알바 draw - see ALBA_TYPE_JOB_WEIGHT.
// Returns isTypeMatch too (candidate.job.name won't tell you whether GENERIC_JOBS
// happened to share a matched job's name) so doAlba knows when a 대성공 roll applies.
function pickJob(pet) {
  const matchedJobs = [...new Set(pet.types)].map((t) => JOB_POOL[t]).filter(Boolean);

  const candidates = [];
  if (matchedJobs.length > 0) {
    const perTypeWeight = ALBA_TYPE_JOB_WEIGHT / matchedJobs.length;
    for (const job of matchedJobs) candidates.push({ job, isTypeMatch: true, weight: perTypeWeight });
  }
  const genericWeight = (100 - (matchedJobs.length > 0 ? ALBA_TYPE_JOB_WEIGHT : 0)) / GENERIC_JOBS.length;
  for (const job of GENERIC_JOBS) candidates.push({ job, isTypeMatch: false, weight: genericWeight });

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function randomAlbaReward() {
  return Math.floor(Math.random() * (ALBA_REWARD_MAX - ALBA_REWARD_MIN + 1)) + ALBA_REWARD_MIN;
}

function isAlbaAvailableToday(pet) {
  return pet.albaDate !== todayString();
}

// True while a dispatch is still running - read lazily off dispatchUntil
// rather than cleared by a scheduled job, so a pet just "comes back" the next
// time any command touches it after its dispatchUntil has passed.
function isDispatched(pet) {
  return !!(pet.dispatchUntil && pet.dispatchUntil.getTime() > Date.now());
}

function dispatchRemainingDays(pet) {
  if (!isDispatched(pet)) return 0;
  return Math.ceil((pet.dispatchUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function dispatchPayout(days) {
  return DISPATCH_DAILY_RATE * days;
}

// "10번의 기회" - mobile-gacha-style reroll allowance. Cost is paid once at
// final confirmation, not per draw, so rerolling is free as long as you
// haven't used up all 10 attempts (see pet/adoptSession.js + commands/pet-adopt.js).
const MAX_ADOPT_ATTEMPTS = 10;

const FEED_COOLDOWN_MS = 2.5 * 60 * 60 * 1000; // 2h30m - prevents refilling hunger nonstop
const PLAY_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h

// Daily caps on top of the cooldowns above - without these, someone who never
// sleeps could still level far ahead of everyone else just by never missing a
// cooldown window. See the "다같이 천천히" design discussion this was tuned for.
const MAX_FEEDS_PER_DAY = 6;
const MAX_PLAYS_PER_DAY = 6;

// Both scale with level at the same ratio as EXP_PER_LEVEL_MULTIPLIER below,
// so the actual pace (actions needed per level) never changes even though
// the raw numbers shown to players grow - see that constant's comment.
// Feed costs more than play (FEED_COST/PLAY_COST) and now pays out more exp
// per point too - previously play was strictly better value (cheaper AND more
// exp), which made feeding a pet feel like a chore you only did for hunger.
const FEED_EXP_MULTIPLIER = 25;
const PLAY_EXP_MULTIPLIER = 15;

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

async function getPet(guildId, userId, slot) {
  return Pet.findOne({ guildId, userId, slot });
}

// All of a user's ACTIVE (slotted) pets, slot 1 first - excludes anything
// parked in storage (see getStorage). Empty array if they have none active.
async function getPets(guildId, userId) {
  return Pet.find({ guildId, userId, slot: { $exists: true } }).sort({ slot: 1 });
}

// All of a user's pets parked in storage (see MAX_STORAGE), lowest storageSlot
// first. Storage is free and available to everyone up to MAX_STORAGE - no
// unlock step like the paid active slots.
async function getStorage(guildId, userId) {
  return Pet.find({ guildId, userId, storageSlot: { $exists: true } }).sort({ storageSlot: 1 });
}

// How many of MAX_SLOTS this user has paid to unlock (1 if never bought any -
// see UserPoints.petSlotsUnlocked's schema default).
async function getUnlockedSlots(guildId, user) {
  const balance = await getOrCreatePoints(guildId, user);
  return balance.petSlotsUnlocked ?? 1;
}

// Which slot number is this user's "active" pet - the one 슬롯-less
// feed/play/rename/release commands act on (see UserPoints.activePetSlot).
// Doesn't guarantee a pet actually exists there (e.g. it was released without
// switching away first) - resolvePetForAction handles that case.
async function getActiveSlot(guildId, user) {
  const balance = await getOrCreatePoints(guildId, user);
  return balance.activePetSlot ?? 1;
}

// Switches which slot is "active" - only allowed onto a slot that currently
// has a pet in it, otherwise slot-less commands would silently do nothing.
async function setActiveSlot(guildId, user, slot) {
  const pet = await getPet(guildId, user.id, slot);
  if (!pet) return { ok: false, reason: "slot-empty" };

  const balance = await getOrCreatePoints(guildId, user);
  balance.activePetSlot = slot;
  await balance.save();

  return { ok: true, pet };
}

// Deletes one specific pet outright (no partial refund of the adopt cost) so
// that slot can be re-adopted into - re-adopting pays the full cost again since
// checkAdoptEligibility only blocks when every unlocked slot is full, which is
// the actual point sink here rather than charging for the release itself.
// Returns the deleted pet (for a "you gave up on Lv.N X" message) or null if
// that slot was already empty.
async function releasePet(guildId, userId, slot) {
  return Pet.findOneAndDelete({ guildId, userId, slot });
}

// First storage slot (1..MAX_STORAGE) with no pet in it, or null if storage
// is full.
async function getNextEmptyStorageSlot(guildId, userId) {
  const stored = await getStorage(guildId, userId);
  const occupied = new Set(stored.map((p) => p.storageSlot));
  for (let s = 1; s <= MAX_STORAGE; s++) {
    if (!occupied.has(s)) return s;
  }
  return null;
}

// Parks an active-slot pet in storage instead of releasing it - frees that
// slot up (for a fresh adopt or a different stored pet) without deleting the
// original. Deliberately only ever touches slot/storageSlot: cooldown/daily-
// cap fields (lastFedAt, feedsToday, feedsTodayDate, ...) are left exactly as
// they were, so store->retrieve can't be used to dodge a cooldown or reset a
// daily cap. Uses findOneAndUpdate with an explicit $unset (not
// `pet.slot = undefined; pet.save()`, which Mongoose doesn't reliably turn
// into an actual $unset on the wire) so the old field is really gone, not
// just undefined in memory.
async function storePet(guildId, userId, activeSlot) {
  const pet = await getPet(guildId, userId, activeSlot);
  if (!pet) return { ok: false, reason: "slot-empty" };
  if (isDispatched(pet)) return { ok: false, reason: "dispatched" };

  const nextStorageSlot = await getNextEmptyStorageSlot(guildId, userId);
  if (nextStorageSlot == null) return { ok: false, reason: "storage-full" };

  const updated = await Pet.findOneAndUpdate(
    { _id: pet._id },
    { $unset: { slot: 1 }, $set: { storageSlot: nextStorageSlot } },
    { returnDocument: "after" }
  );
  return { ok: true, pet: updated };
}

// Pulls a stored pet back into an active slot - the target slot defaults to
// the next open unlocked one (same rule as adopting) unless explicitly given.
// An explicit target still has to be one of the user's paid-for unlocked
// slots - otherwise this would let someone bypass /펫슬롯's unlock cost by
// just naming an unpaid slot number directly.
async function retrievePet(guildId, user, storageSlot, targetActiveSlot) {
  const pet = await Pet.findOne({ guildId, userId: user.id, storageSlot });
  if (!pet) return { ok: false, reason: "storage-empty" };

  let slot = targetActiveSlot;
  if (slot != null) {
    const unlockedSlots = await getUnlockedSlots(guildId, user);
    if (slot > unlockedSlots) return { ok: false, reason: "slot-locked" };
  } else {
    slot = await getNextEmptySlot(guildId, user);
  }
  if (slot == null) return { ok: false, reason: "slots-full" };

  const occupant = await getPet(guildId, user.id, slot);
  if (occupant) return { ok: false, reason: "slot-taken" };

  const updated = await Pet.findOneAndUpdate({ _id: pet._id }, { $unset: { storageSlot: 1 }, $set: { slot } }, { returnDocument: "after" });
  return { ok: true, pet: updated };
}

// Shared by feed/play/rename/release: resolves which of a user's pets a
// slot-less invocation should act on.
//  - no pets at all -> "no-pet"
//  - a slot was given -> that exact slot ("slot-empty" if nothing's there),
//    regardless of which slot is active (an explicit slot always wins)
//  - no slot given, exactly one pet -> that pet (so a single-pet owner never
//    has to think about slots or activation, same as before this system existed)
//  - no slot given, 2+ pets -> whichever slot is "active" (see
//    UserPoints.activePetSlot / /펫슬롯's 활성화 buttons). If the active slot
//    doesn't actually have a pet right now (e.g. it was released and nothing
//    new was activated), "no-active-pet" tells the command layer to ask the
//    user to pick one instead of silently acting on the wrong pet.
async function resolvePetForAction(guildId, user, requestedSlot) {
  if (requestedSlot != null) {
    const pet = await getPet(guildId, user.id, requestedSlot);
    return pet ? { ok: true, pet } : { ok: false, reason: "slot-empty" };
  }

  const pets = await getPets(guildId, user.id);
  if (pets.length === 0) return { ok: false, reason: "no-pet" };
  if (pets.length === 1) return { ok: true, pet: pets[0] };

  const activeSlot = await getActiveSlot(guildId, user);
  const activePet = pets.find((p) => p.slot === activeSlot);
  return activePet ? { ok: true, pet: activePet } : { ok: false, reason: "no-active-pet", pets };
}

// Every action below returns a small { ok, reason?, ... } object instead of
// throwing, so the command layer can turn each failure reason into a
// user-friendly Korean reply without a pile of try/catch.

// First unlocked slot (1..petSlotsUnlocked) with no pet in it, or null if
// every unlocked slot is already occupied.
async function getNextEmptySlot(guildId, user) {
  const [unlockedSlots, pets] = await Promise.all([getUnlockedSlots(guildId, user), getPets(guildId, user.id)]);
  const occupied = new Set(pets.map((p) => p.slot));
  for (let slot = 1; slot <= unlockedSlots; slot++) {
    if (!occupied.has(slot)) return slot;
  }
  return null;
}

// Side-effect-free check, used both before starting a preview session and
// again right before actually committing one (confirmAdopt) - someone could
// adopt from another channel, drop below the cost, or fill their last open
// slot while rerolling.
async function checkAdoptEligibility(guildId, user, generationGroup) {
  const targetSlot = await getNextEmptySlot(guildId, user);
  if (targetSlot == null) return { ok: false, reason: "slots-full" };

  const cost = ADOPT_COSTS[generationGroup] ?? ADOPT_COSTS[1];
  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < cost) return { ok: false, reason: "not-enough-points", cost };

  return { ok: true, targetSlot, cost };
}

// Draws one random adoptable candidate (first-stage, evolvable - normal
// level-up lines most of the time, rare stone/trade/friendship-only lines
// like Eevee occasionally - see pokeApiClient.getRandomEvolvableBaseSpecies).
// Doesn't touch points or the DB - purely for preview/reroll.
async function drawCandidate(generationGroup) {
  return getRandomEvolvableBaseSpecies(generationGroup);
}

// Commits a previously-drawn candidate as the user's pet: re-checks
// eligibility (things may have changed since the preview started), deducts
// that generation's ADOPT_COSTS entry, and creates the Pet doc.
async function confirmAdopt(guildId, user, candidate, generationGroup) {
  const eligibility = await checkAdoptEligibility(guildId, user, generationGroup);
  if (!eligibility.ok) return eligibility;

  await addPoints(guildId, user, -eligibility.cost);

  const now = Date.now();
  const pet = await Pet.create({
    guildId,
    userId: user.id,
    slot: eligibility.targetSlot,
    speciesId: candidate.id,
    speciesName: candidate.displayName,
    spriteUrl: candidate.spriteUrl,
    types: candidate.types,
    baseAttack: candidate.baseAttack,
    baseDefense: candidate.baseDefense,
    nextEvolutionOptions: candidate.nextEvolution.options,
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

// Pets adopted before branch-choice evolution existed only carry the legacy
// nextEvolutionId - a SINGLE branch that was already randomly pre-picked at
// adoption time (back when there was no picker at all, see
// pokeApiClient.getRandomEvolvableBaseSpecies's old single-option shape).
// Blindly promoting that stale id into a one-item nextEvolutionOptions would
// silently deny the owner any real choice (confirmed in production: an Eevee
// "evolved on its own" because its only stored option was whatever branch
// had been rolled weeks earlier at adoption). Instead this re-derives the
// FULL current branch list from the pet's actual species via
// getFollowingEvolution, the same lookup a freshly-adopted pet gets - so a
// legacy Eevee gets the real 5-way picker, not a fake single option.
// undefined (not just an empty array) means "never computed" - a pet already
// at a true final form has nextEvolutionOptions explicitly set to [] by
// evolvePet, so it's never mistaken for a legacy doc and recomputed again.
async function ensureEvolutionOptions(pet) {
  if (pet.nextEvolutionOptions !== undefined || !pet.nextEvolutionId) return;
  const following = await getFollowingEvolution(pet.speciesId).catch(() => null);
  pet.nextEvolutionOptions = following?.options ?? [];
  if (following?.minLevel != null) pet.nextEvolutionMinLevel = following.minLevel;
  await pet.save();
}

function isEvolutionReady(pet) {
  return !!pet.nextEvolutionOptions?.length && pet.nextEvolutionMinLevel != null && pet.level >= pet.nextEvolutionMinLevel;
}

// Resolves which pet a /진화 invocation targets (same slot rules as
// feed/play) and backfills its evolution options, without spending anything -
// used by the command layer to decide whether to evolve directly (one option)
// or show a branch picker (2+), before any cost is charged.
async function getEvolutionStatus(guildId, user, requestedSlot) {
  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  if (isDispatched(resolved.pet)) return { ok: false, reason: "dispatched", pet: resolved.pet };

  await ensureEvolutionOptions(resolved.pet);
  return { ok: true, pet: resolved.pet, ready: isEvolutionReady(resolved.pet) };
}

// Commits one of a pet's nextEvolutionOptions: charges EVOLVE_COST, routes it
// like feed/play, then updates species/type/battle-stat fields and refreshes
// the following evolution's options. Returns { ok:false, reason } for the
// same not-ready/points-short/slot-resolution cases getEvolutionStatus and
// feed/play already surface, plus "invalid-choice" if chosenSpeciesId isn't
// actually one of this pet's current options (stale select menu, tampering).
async function evolvePet(guildId, user, requestedSlot, chosenSpeciesId) {
  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  const pet = resolved.pet;
  if (isDispatched(pet)) return { ok: false, reason: "dispatched" };

  await ensureEvolutionOptions(pet);
  if (!isEvolutionReady(pet)) return { ok: false, reason: "not-ready" };

  const choice = pet.nextEvolutionOptions.find((o) => o.speciesId === chosenSpeciesId);
  if (!choice) return { ok: false, reason: "invalid-choice" };

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < EVOLVE_COST) return { ok: false, reason: "not-enough-points" };

  await addPoints(guildId, user, -EVOLVE_COST);
  await routeActionCost(guildId, EVOLVE_COST);

  const fromName = pet.speciesName;
  const newSpecies = await getSpeciesById(choice.speciesId);
  const nextStep = await getFollowingEvolution(choice.speciesId).catch(() => null);

  pet.speciesId = choice.speciesId;
  pet.speciesName = newSpecies.displayName;
  pet.spriteUrl = newSpecies.spriteUrl;
  pet.types = newSpecies.types;
  pet.baseAttack = newSpecies.baseAttack;
  pet.baseDefense = newSpecies.baseDefense;
  pet.nextEvolutionOptions = nextStep?.options ?? [];
  pet.nextEvolutionMinLevel = nextStep?.minLevel ?? null;
  await pet.save();

  return { ok: true, pet, from: fromName, to: pet.speciesName };
}

// How many times today (todayString()'s noon-ET day) this pet has already
// used the given action - 0 if the stored date doesn't match today, i.e. the
// count implicitly resets the first time the action is used on a new day.
function dailyCountSoFar(pet, countField, dateField) {
  return pet[dateField] === todayString() ? pet[countField] : 0;
}

function recordDailyAction(pet, countField, dateField) {
  pet[countField] = dailyCountSoFar(pet, countField, dateField) + 1;
  pet[dateField] = todayString();
}

async function feedPet(guildId, user, requestedSlot) {
  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  const pet = resolved.pet;
  if (isDispatched(pet)) return { ok: false, reason: "dispatched", pet };

  const remainingMs = pet.lastFedAt ? FEED_COOLDOWN_MS - (Date.now() - pet.lastFedAt.getTime()) : 0;
  if (remainingMs > 0) return { ok: false, reason: "cooldown", remainingMs };

  if (dailyCountSoFar(pet, "feedsToday", "feedsTodayDate") >= MAX_FEEDS_PER_DAY) {
    return { ok: false, reason: "daily-limit" };
  }

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < FEED_COST) return { ok: false, reason: "not-enough-points" };

  await addPoints(guildId, user, -FEED_COST);
  await routeActionCost(guildId, FEED_COST);
  pet.lastFedAt = new Date();
  recordDailyAction(pet, "feedsToday", "feedsTodayDate");
  const buffMultiplier = missionService.getExpBuffMultiplier(balance);
  const leveledUp = applyExp(pet, Math.round(feedExpForLevel(pet.level) * buffMultiplier));
  await pet.save();

  const missionResult = await missionService.recordAction(guildId, user, "feed");
  return { ok: true, pet, leveledUp, missionResult };
}

async function playWithPet(guildId, user, requestedSlot) {
  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  const pet = resolved.pet;
  if (isDispatched(pet)) return { ok: false, reason: "dispatched", pet };

  const remainingMs = pet.lastPlayedAt ? PLAY_COOLDOWN_MS - (Date.now() - pet.lastPlayedAt.getTime()) : 0;
  if (remainingMs > 0) return { ok: false, reason: "cooldown", remainingMs };

  if (dailyCountSoFar(pet, "playsToday", "playsTodayDate") >= MAX_PLAYS_PER_DAY) {
    return { ok: false, reason: "daily-limit" };
  }

  const balance = await getOrCreatePoints(guildId, user);
  if (balance.points < PLAY_COST) return { ok: false, reason: "not-enough-points" };

  await addPoints(guildId, user, -PLAY_COST);
  await routeActionCost(guildId, PLAY_COST);
  pet.lastPlayedAt = new Date();
  recordDailyAction(pet, "playsToday", "playsTodayDate");
  const buffMultiplier = missionService.getExpBuffMultiplier(balance);
  const leveledUp = applyExp(pet, Math.round(playExpForLevel(pet.level) * buffMultiplier));
  await pet.save();

  const missionResult = await missionService.recordAction(guildId, user, "play");
  return { ok: true, pet, leveledUp, missionResult };
}

// Daily job draw - pure income, deliberately no exp (feed/play stay the only
// leveling loop, see the design discussion this was split from). No
// routeActionCost either since nothing is being spent here to route.
async function doAlba(guildId, user, requestedSlot) {
  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  const pet = resolved.pet;

  if (isDispatched(pet)) return { ok: false, reason: "dispatched", pet };
  if (!isAlbaAvailableToday(pet)) return { ok: false, reason: "daily-limit" };

  await ensureBattleStats(pet); // backfills pet.types for pets older than /펫대전
  const { job, isTypeMatch } = pickJob(pet);
  let reward = randomAlbaReward();
  const greatSuccess = isTypeMatch && Math.random() < ALBA_GREAT_SUCCESS_CHANCE;
  if (greatSuccess) reward = Math.round(reward * ALBA_GREAT_SUCCESS_MULTIPLIER);

  await addPoints(guildId, user, reward);
  pet.albaDate = todayString();
  await pet.save();

  const missionResult = await missionService.recordAction(guildId, user, "alba");
  return { ok: true, pet, job, reward, greatSuccess, missionResult };
}

// Multi-day auto dispatch - guaranteed payout charged up front (see
// dispatchPayout), no reroll/early-return once started. The slot stays
// occupied and blocked from feed/play/evolve/release until dispatchUntil
// passes (see isDispatched's callers).
async function startDispatch(guildId, user, requestedSlot, days) {
  if (!DISPATCH_DURATIONS.includes(days)) return { ok: false, reason: "invalid-duration" };

  const resolved = await resolvePetForAction(guildId, user, requestedSlot);
  if (!resolved.ok) return resolved;
  const pet = resolved.pet;

  if (isDispatched(pet)) return { ok: false, reason: "already-dispatched" };

  const payout = dispatchPayout(days);
  await addPoints(guildId, user, payout);
  pet.dispatchUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await pet.save();

  return { ok: true, pet, days, payout };
}

// "1번 파이리(Lv.5), 2번 꼬부기(Lv.3)" - used when a slot-less action command
// (feed/play/rename/release) is ambiguous across a user's multiple pets, so
// the reply can list what to pick from.
function formatSlotChoices(pets) {
  return pets.map((p) => `${p.slot}번 ${p.nickname ?? p.speciesName}(Lv.${p.level})`).join(", ");
}

function getDisplayStats(pet) {
  return {
    hunger: decayedStat(pet.lastFedAt, HUNGER_DECAY_HOURS),
    happiness: decayedStat(pet.lastPlayedAt, HAPPINESS_DECAY_HOURS),
    expNeeded: expForNextLevel(pet.level),
  };
}

// Buys the next slot in sequence (2, then 3) - can't skip ahead. Single
// fetch-mutate-save on the UserPoints doc (not addPoints + a separate save)
// so the points deduction and the slot bump land atomically in one write.
async function unlockNextSlot(guildId, user) {
  const balance = await getOrCreatePoints(guildId, user);
  const current = balance.petSlotsUnlocked ?? 1;
  if (current >= MAX_SLOTS) return { ok: false, reason: "maxed" };

  const nextSlot = current + 1;
  const cost = SLOT_UNLOCK_COSTS[nextSlot];
  if (balance.points < cost) return { ok: false, reason: "not-enough-points", cost, nextSlot };

  balance.points -= cost;
  balance.petSlotsUnlocked = nextSlot;
  await balance.save();

  return { ok: true, slot: nextSlot, cost };
}

module.exports = {
  checkAdoptEligibility,
  drawCandidate,
  confirmAdopt,
  getPet,
  getPets,
  getUnlockedSlots,
  getActiveSlot,
  setActiveSlot,
  resolvePetForAction,
  releasePet,
  getStorage,
  storePet,
  retrievePet,
  feedPet,
  playWithPet,
  getDisplayStats,
  formatSlotChoices,
  unlockNextSlot,
  ensureEvolutionOptions,
  isEvolutionReady,
  getEvolutionStatus,
  evolvePet,
  doAlba,
  startDispatch,
  isAlbaAvailableToday,
  isDispatched,
  dispatchRemainingDays,
  dispatchPayout,
  ADOPT_COSTS,
  FEED_COST,
  PLAY_COST,
  EVOLVE_COST,
  FEED_COOLDOWN_MS,
  PLAY_COOLDOWN_MS,
  MAX_FEEDS_PER_DAY,
  MAX_PLAYS_PER_DAY,
  MAX_ADOPT_ATTEMPTS,
  MAX_SLOTS,
  SLOT_UNLOCK_COSTS,
  MAX_STORAGE,
  ALBA_REWARD_MIN,
  ALBA_REWARD_MAX,
  DISPATCH_DURATIONS,
  DISPATCH_DAILY_RATE,
};
