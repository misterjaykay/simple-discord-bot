const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const betSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String },
    optionIndex: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

// Only one OPEN/LOCKED prediction is allowed per guild at a time (enforced in the
// command, not here) to keep the "which prediction am I betting on" question simple.
const predictionSchema = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String },
  question: { type: String, required: true },
  options: [{ type: String, required: true }], // label list; array index doubles as the option's id
  bets: [betSchema],
  status: {
    type: String,
    enum: ["OPEN", "LOCKED", "RESOLVED", "CANCELLED"],
    default: "OPEN",
  },
  winningOptionIndex: { type: Number },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  // Optional auto-lock deadline. When set, the prediction locks itself (same as
  // /예측 마감) once this time passes, even with nobody around to run the command.
  lockAt: { type: Date },
});

module.exports = mongoose.model("Prediction", predictionSchema);
