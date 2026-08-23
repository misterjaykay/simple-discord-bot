const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const matchSchema = new Schema(
  {
    player1UserId: { type: String, required: true },
    player2UserId: { type: String }, // absent when player1 has a bye
    // One owner can now enter multiple pets (see /펫대전 신청), so a match can
    // have player1UserId === player2UserId - these petId fields are what
    // actually disambiguates which of that owner's pets is which side.
    player1PetId: { type: Schema.Types.ObjectId, ref: "Pet" },
    player2PetId: { type: Schema.Types.ObjectId, ref: "Pet" },
    winnerUserId: { type: String },
    winnerPetId: { type: Schema.Types.ObjectId, ref: "Pet" },
    isBye: { type: Boolean, default: false },
    // Per-roll winner side ("A" = player1, "B" = player2), in order - length 1
    // outside the final, up to 3 in the final (best-of-3). Lets the bracket
    // embed render "⭕❌⭕ vs ❌⭕❌" instead of just marking the overall winner
    // (see tournamentService's formatBracketMessage). Side letters rather than
    // userId for the same same-owner-multi-pet reason as winnerPetId above.
    rounds: { type: [String] },
  },
  { _id: false }
);

const roundSchema = new Schema(
  {
    round: { type: Number, required: true },
    matches: [matchSchema],
  },
  { _id: false }
);

// Weekly single-elimination pet tournament ("/펫대전" - see pet/tournamentService.js).
// One guild-wide recurring cycle, mirroring the draw-style lottery's
// OPEN/DRAWN/ROLLOVER pattern (models/lottery.js): only one REGISTRATION doc
// per guild at a time, and a run (COMPLETED or CANCELLED-for-low-turnout)
// always opens the next week's REGISTRATION doc automatically.
const petTournamentSchema = new Schema({
  guildId: { type: String, required: true },
  status: {
    type: String,
    // REGISTRATION: accepting entries. COMPLETED: bracket ran, winner paid.
    // CANCELLED: too few participants (refunded) or an admin stopped the cycle.
    enum: ["REGISTRATION", "COMPLETED", "CANCELLED"],
    default: "REGISTRATION",
  },
  participants: [
    {
      userId: { type: String, required: true },
      username: { type: String },
      // Which of the user's pets (by slot, and the exact doc via petId) is
      // entering this week - captured at registration time so the bracket
      // always battles with that specific pet even if the owner later
      // touches other slots. See pet/tournamentService.js registerParticipant.
      petId: { type: Schema.Types.ObjectId, ref: "Pet" },
      slot: { type: Number },
      _id: false,
    },
  ],
  // Entries stop being accepted after this time (Friday 9 PM ET), but the
  // bracket itself doesn't run until runAt (Friday 11:30 PM ET) - see
  // pet/tournamentService.js's REGISTRATION_CLOSE_HOUR / RUN_HOUR.
  registrationCloseAt: { type: Date },
  runAt: { type: Date },
  bracket: [roundSchema],
  winnerId: { type: String },
  winnerPetId: { type: Schema.Types.ObjectId, ref: "Pet" },
  winnerPetName: { type: String },
  runnerUpId: { type: String },
  runnerUpPetId: { type: Schema.Types.ObjectId, ref: "Pet" },
  runnerUpPetName: { type: String },
  pot: { type: Number },
  houseCut: { type: Number },
  winnerPayout: { type: Number },
  runnerUpPayout: { type: Number },
  createdBy: { type: String, required: true }, // discord user id, or "system" for auto-opened cycles
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
});

module.exports = mongoose.model("PetTournament", petTournamentSchema);
