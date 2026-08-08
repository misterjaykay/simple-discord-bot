const GuildPointsConfig = require("../models/guild-points-config");

// A "house wallet" funded by the draw-style lottery's ticket house cut
// (see lotteryDrawService.runDraw) instead of that cut just vanishing.
// Admins spend it via /포인트관리 하우스지급 - since bonuses come out of a real,
// finite balance instead of being minted from nothing, admins can't just
// spam grants indefinitely, and the house cut gets an actual purpose instead
// of being a pure sink.
async function getHouseBank(guildId) {
  const config = await GuildPointsConfig.findOne({ guildId });
  return config?.housePointsBank || 0;
}

async function addToHouseBank(guildId, amount) {
  if (amount <= 0) return;
  await GuildPointsConfig.findOneAndUpdate({ guildId }, { $inc: { housePointsBank: amount } }, { upsert: true });
}

// Atomic conditional decrement (only succeeds if the balance is actually
// sufficient) so two admins spending at the same moment can't both succeed
// past what's really available. Throws a friendly error instead of allowing
// a negative balance.
async function spendFromHouseBank(guildId, amount) {
  const updated = await GuildPointsConfig.findOneAndUpdate(
    { guildId, housePointsBank: { $gte: amount } },
    { $inc: { housePointsBank: -amount } },
    { returnDocument: "after" }
  );

  if (!updated) {
    const current = await getHouseBank(guildId);
    throw new Error(`하우스 잔액이 부족해요. (필요 ${amount.toLocaleString()} / 보유 ${current.toLocaleString()} 포인트)`);
  }

  return updated.housePointsBank;
}

module.exports = { getHouseBank, addToHouseBank, spendFromHouseBank };
