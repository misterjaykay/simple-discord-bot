const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// One pet per user per guild (v1 keeps this simple - no multi-pet inventory).
const petSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  nickname: {
    type: String,
  },
  speciesId: {
    type: Number, // PokeAPI pokemon id (1-386, Gen 1-3 - see pet/pokeApiClient.js)
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
  // Next evolution stage's PokeAPI id + the level it triggers at - null once
  // the pet has reached a stage with no further plain level-up evolution
  // (either a true final form, or the only path forward needs a
  // stone/trade/friendship condition this bot can't fulfill).
  nextEvolutionId: {
    type: Number,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

petSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Pet", petSchema);
