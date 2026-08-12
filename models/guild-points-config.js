const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Per-guild overrides for point-earning rates - lets admins run temporary
// events (e.g. "Happy Friday" double voice points) without a code change or
// redeploy. Only one field is used today (voicePointsPerInterval) but this is
// kept as its own small collection so future event knobs (chat rate, etc.)
// can be added the same way.
const guildPointsConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  // Overrides voicePointsService's default points-per-5-minutes while set.
  voicePointsPerInterval: {
    type: Number,
  },
  // When set, the override above auto-reverts to the default once this time
  // passes (re-armed from the DB on startup, same pattern as prediction auto-lock).
  voicePointsExpiresAt: {
    type: Date,
  },
  // Banked jackpot contributions from instant-lottery losses (/복권 긁기, see
  // commands/lottery.js) that arrived while no draw-style round was OPEN.
  // Swept into the next round's bonusPot when one starts - see
  // lotteryDrawService.startLottery.
  lotteryJackpotBank: {
    type: Number,
    default: 0,
  },
  // "House wallet" funded by the draw-style lottery's ticket house cut (see
  // lotteryDrawService.runDraw) instead of that cut just vanishing. Admins
  // spend it via /포인트관리 하우스지급 - see points/houseBankService.js.
  housePointsBank: {
    type: Number,
    default: 0,
  },
  // Fixed channel admins designate for weekly /펫대전 bracket results (see
  // commands/pet/pet-tournament.js '채널설정' and pet/tournamentService.js).
  // Unlike the lottery's per-round announceChannelId, this persists across
  // every weekly cycle until an admin changes it.
  petTournamentChannelId: {
    type: String,
  },
  // Optional restriction (see /펫채널설정 and pet/petChannelGuard.js) so every
  // pet command (입양/정보/밥주기/놀아주기/이름변경/파양/대전) only works in one
  // designated channel. Absent = unrestricted, same as before this existed.
  petChannelId: {
    type: String,
  },
  // Half of every /펫밥주기·/펫놀아주기 cost lands here instead of vanishing
  // (the other half goes to housePointsBank) - swept into the weekly
  // /펫대전 prize pool at settlement, replacing the old flat per-participant
  // bonus. See points/petTournamentBonusBankService.js.
  petTournamentBonusBank: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("GuildPointsConfig", guildPointsConfigSchema);
