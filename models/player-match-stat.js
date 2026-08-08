const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Migrated from the standalone valo-tracker app. One doc per player-per-match
// performance line (kills/deaths/assists/ACS for that player in that match).
const playerMatchStatSchema = new Schema({
  match: { type: Schema.Types.ObjectId, ref: "Match", required: true },
  player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
  agent: { type: String, required: true },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, // ACS
  createdAt: { type: Date, default: Date.now },
});

playerMatchStatSchema.virtual("kda").get(function () {
  return this.deaths === 0 ? (this.kills + this.assists).toFixed(2) : ((this.kills + this.assists) / this.deaths).toFixed(2);
});

module.exports = mongoose.model("PlayerMatchStat", playerMatchStatSchema);
