const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ticketSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String },
    count: { type: Number, required: true }, // tickets bought by this user in this round
  },
  { _id: false }
);

// Draw-style ("추첨") lottery: a recurring weekly round (Powerball-style) - one
// guild-wide pot built from ticket sales, drawn every Saturday 11:30 PM US
// Eastern time (see getNextSaturdayNightET in points/lotteryDrawService.js).
// Most draws don't actually pay anyone (see JACKPOT_HIT_CHANCE), in which case
// the whole pot rolls over into next week's round instead of vanishing -
// that's what keeps a jackpot building week over week. Reachable via
// `/복권 추첨 ...` (commands/lottery.js). Only one OPEN round per guild at a
// time; each draw (win or rollover) automatically opens the next week's round.
const lotterySchema = new Schema({
  guildId: { type: String, required: true },
  status: {
    type: String,
    // OPEN: accepting ticket purchases. DRAWN: a winner was paid this round.
    // ROLLOVER: the weekly draw happened but nobody won - pot carried forward.
    // CANCELLED: an admin manually ended the recurring cycle (see /복권 추첨 종료).
    enum: ["OPEN", "DRAWN", "ROLLOVER", "CANCELLED"],
    default: "OPEN",
  },
  ticketPrice: { type: Number, required: true },
  // Per-person cap on tickets bought in this round - keeps one wealthy member
  // from buying so many tickets they effectively lock up that week's odds.
  // Carried forward unchanged to each auto-opened next round.
  maxTicketsPerPerson: { type: Number },
  tickets: [ticketSchema],
  // Extra jackpot money that isn't tied to anyone's tickets - fed by instant
  // lottery losses (/복권 긁기, see commands/lottery.js), any bank swept in from
  // GuildPointsConfig.lotteryJackpotBank when this round started, and/or a
  // rolled-over pot from a previous week with no winner. Counted in the
  // pot/payout the same as ticket money, just not owned by a bettor.
  bonusPot: { type: Number, default: 0 },
  // When the next automatic weekly drawing should happen (re-armed from the
  // DB on startup, same pattern as prediction auto-lock / voice point events).
  drawAt: { type: Date },
  // Channel to post the 30-min-before announcement and 10-min-before ticket-
  // buyer ping to (see points/lotteryDrawService.js). Captured from wherever
  // `/복권 추첨 시작` was run and carried forward to each auto-opened next round.
  announceChannelId: { type: String },
  winnerId: { type: String },
  winnerPayout: { type: Number },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }, // when this round was drawn/rolled-over/cancelled
});

module.exports = mongoose.model("Lottery", lotterySchema);
