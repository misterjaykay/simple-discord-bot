const GuildPointsConfig = require("../models/guild-points-config");

// Lives here (not under pet/) so both pet/petService.js (which feeds it) and
// pet/tournamentService.js (which sweeps it) can import without a circular
// require - tournamentService already depends on petService for getPet.

async function getPetTournamentBonusBank(guildId) {
  const config = await GuildPointsConfig.findOne({ guildId });
  return config?.petTournamentBonusBank || 0;
}

async function addToPetTournamentBonusBank(guildId, amount) {
  if (amount <= 0) return;
  await GuildPointsConfig.findOneAndUpdate({ guildId }, { $inc: { petTournamentBonusBank: amount } }, { upsert: true });
}

// Reads the current balance and resets it to 0 in one atomic op - used once
// per weekly tournament settlement so the whole week's accumulated feed/play
// contributions land in that week's prize pool (see tournamentService.runTournament).
async function sweepPetTournamentBonusBank(guildId) {
  const config = await GuildPointsConfig.findOneAndUpdate(
    { guildId },
    { petTournamentBonusBank: 0 },
    { upsert: true, new: false }
  );
  return config?.petTournamentBonusBank || 0;
}

module.exports = { getPetTournamentBonusBank, addToPetTournamentBonusBank, sweepPetTournamentBonusBank };
