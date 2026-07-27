require("dotenv").config();
const { REST, Routes } = require("discord.js");

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Fixes the classic "every command shows up twice" symptom: it happens when
// deploy-commands.js was run once WITH GUILD_ID set (registers guild-specific
// commands, for instant testing) and once WITHOUT it (registers the same
// commands globally). Both registrations exist independently in Discord, so
// the client shows both - one guild command + one global command per name.
// This wipes only the guild-specific set for GUILD_ID, leaving the global set
// (which already covers every server the bot is in) as the single source.
if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("BOT_TOKEN, CLIENT_ID, and GUILD_ID must all be set in .env (GUILD_ID = the server showing duplicates).");
  process.exit(1);
}

const rest = new REST().setToken(BOT_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log(`Cleared guild-specific commands for guild ${GUILD_ID}. Global commands are untouched.`);
  } catch (error) {
    console.error(error);
  }
})();
