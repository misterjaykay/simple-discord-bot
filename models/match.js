const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Migrated from the standalone valo-tracker app. One doc per tracked scrim/match.
const matchSchema = new Schema({
  date: { type: Date, required: true, default: Date.now },
  map: { type: String, required: true },
  result: { type: String, enum: ["win", "loss"], required: true },
  queueType: { type: Number, enum: [2, 3, 5], required: true },
  scoreUs: { type: Number, default: null }, // 우리팀 라운드 수
  scoreThem: { type: Number, default: null }, // 상대팀 라운드 수
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Match", matchSchema);
