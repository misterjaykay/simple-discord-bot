const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Migrated from the standalone valo-tracker app (Valorant scrim/match tracker)
// ahead of integrating it into this bot. One doc per tracked player.
const playerSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  tag: { type: String, trim: true }, // 디코 태그 등
  // Set via /발로연동 (admin only) - links this tracked player to a Discord
  // account so stat commands can take a @멘션 instead of the exact nickname.
  // sparse so the many not-yet-linked players don't collide on a shared null.
  discordUserId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Player", playerSchema);
