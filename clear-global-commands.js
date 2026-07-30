require("dotenv").config();
const { REST, Routes } = require("discord.js");

const { BOT_TOKEN, CLIENT_ID } = process.env;

// Companion to clear-guild-commands.js. Use this one when GUILD_ID is the
// permanent, intended scope (e.g. both Railway and local dev point at the
// same single server) and the duplicates are leftover GLOBAL registrations
// from an earlier deploy that ran without GUILD_ID set. This wipes the
// global command set only; guild-scoped commands for GUILD_ID are untouched.
if (!BOT_TOKEN || !CLIENT_ID) {
  console.error("BOT_TOKEN and CLIENT_ID must be set in .env.");
  process.exit(1);
}

const rest = new REST().setToken(BOT_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log("Cleared global commands. Guild-specific commands are untouched.");
  } catch (error) {
    console.error(error);
  }
})();
