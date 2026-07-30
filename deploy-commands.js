require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error("BOT_TOKEN and CLIENT_ID must be set in your .env file before deploying commands.");
  process.exit(1);
}

const commands = [];

// Recursively collect every command file, including commands/seasonal-commands
// (the old script only read the top-level commands/ folder).
function collectCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCommands(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;

    const command = require(fullPath);
    // Same `deprecated`/`hidden` skip as index.js's loader - a hidden command
    // must never even be registered with Discord, not just left unusable.
    if (command.deprecated || command.hidden) continue;
    if (!("data" in command)) continue;

    commands.push(command.data.toJSON());
  }
}

collectCommands(path.join(__dirname, "commands"));

const rest = new REST().setToken(BOT_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy to a single guild (instant) if GUILD_ID is set, otherwise deploy globally
    // (can take up to an hour to propagate).
    const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);

    const data = await rest.put(route, { body: commands });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
