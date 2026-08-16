const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Up to MAX_SLOTS (3) pets per user per guild - slot 1 is free, slots 2/3
// cost points to unlock (see petService.SLOT_UNLOCK_COSTS / UserPoints.petSlotsUnlocked).
const petSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  slot: {
    type: Number, // 1-3
    required: true,
  },
  nickname: {
    type: String,
  },
  speciesId: {
    type: Number, // PokeAPI pokemon id (1-721, Gen 1-6 - see pet/pokeApiClient.js)
    required: true,
  },
  speciesName: {
    type: String, // Cached display name (Korean if PokeAPI has one, else English)
    required: true,
  },
  spriteUrl: {
    type: String, // Cached so we don't need a PokeAPI round trip just to render /펫정보
  },
  level: {
    type: Number,
    default: 1,
  },
  exp: {
    type: Number,
    default: 0,
  },
  // Legacy single-target field from before branch-choice evolution existed.
  // Superseded by nextEvolutionOptions below - kept only so petService can
  // lazily upgrade old pets into the new shape (see petService.ensureEvolutionOptions).
  nextEvolutionId: {
    type: Number,
  },
  // Next evolution stage candidate(s) - length 1 for a normal single-path
  // line, 2+ for branching lines (Eevee, Tyrogue, Wurmple, ...) where /진화
  // lets the owner pick one. undefined (as opposed to []) means "never
  // computed yet" so a legacy pet can be told apart from a true final form -
  // see petService.ensureEvolutionOptions.
  nextEvolutionOptions: {
    type: [
      {
        speciesId: { type: Number, required: true },
        speciesName: { type: String, required: true },
        _id: false,
      },
    ],
    default: undefined,
  },
  nextEvolutionMinLevel: {
    type: Number,
  },
  // Battle stats - populated at adopt time (see petService.confirmAdopt). Pets
  // adopted before /펫대전 existed have these unset until battleService.ensureBattleStats
  // lazily backfills them right before their first tournament match.
  types: {
    type: [String],
    default: [],
  },
  baseAttack: {
    type: Number,
  },
  baseDefense: {
    type: Number,
  },
  tournamentWins: {
    type: Number,
    default: 0,
  },
  tournamentRunnerUps: {
    type: Number,
    default: 0,
  },
  // hunger/happiness aren't stored as live numbers - they're derived from
  // lastFedAt/lastPlayedAt on read (see petService.getDisplayStats), so a
  // pet's stats keep decaying correctly even if nobody checks in for days.
  lastFedAt: {
    type: Date,
  },
  lastPlayedAt: {
    type: Date,
  },
  // Daily action caps (see petService feedPet/playWithPet) - reset whenever
  // todayString() (points/pointsService.js, noon-ET day boundary) no longer
  // matches the stored date, same pattern as UserPoints.chatPointsToday.
  feedsToday: {
    type: Number,
    default: 0,
  },
  feedsTodayDate: {
    type: String,
  },
  playsToday: {
    type: Number,
    default: 0,
  },
  playsTodayDate: {
    type: String,
  },
  // /펫알바 daily gate - todayString() of the last day this pet did a job,
  // same "reset when the stored date no longer matches today" pattern as
  // feedsTodayDate/playsTodayDate above, just without a per-day count since
  // it's capped at 1/day (see petService.isAlbaAvailableToday).
  albaDate: {
    type: String,
  },
  // /펫파견 - set together at dispatch time, read lazily via
  // petService.isDispatched (pet.dispatchUntil > now) rather than cleared by
  // a scheduled job. undefined means never dispatched / not currently on one.
  dispatchUntil: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

petSchema.index({ guildId: 1, userId: 1, slot: 1 }, { unique: true });

module.exports = mongoose.model("Pet", petSchema);
