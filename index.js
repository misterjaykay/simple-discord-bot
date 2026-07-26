require("dotenv").config();

const fs = require("fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { Client, Collection, Events, GatewayIntentBits, ActivityType } = require("discord.js");

const { handleVoiceStateUpdate } = require("./voicemaster/voiceStateHandler");
const { handleVoicemasterComponent } = require("./voicemaster/componentHandler");
const { handlePredictionComponent } = require("./prediction/componentHandler");

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// Recursively load every command file, including subfolders like commands/seasonal-commands
// (the old loader only read the top-level commands/ folder, so every seasonal command was
// silently never registered).
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;

    const command = require(fullPath);
    if (command.deprecated) continue;

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command at ${fullPath} is missing a required "data" or "execute" property.`);
    }
  }
}

loadCommands(path.join(__dirname, "commands"));

if (process.env.MONGODB_URI) {
  // Masked so it's safe to paste into logs/chat - shows scheme/host, hides the password.
  const maskedUri = process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
  console.log(`[mongo] MONGODB_URI is set, attempting connection to: ${maskedUri}`);

  mongoose.connection.on("connected", () => console.log("[mongo] connected"));
  mongoose.connection.on("error", (err) => console.error("[mongo] connection error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("[mongo] disconnected"));

  // A short serverSelectionTimeoutMS surfaces the real failure reason (bad auth, IP not
  // allowlisted, DNS failure, etc.) quickly instead of only seeing generic "buffering
  // timed out" errors from queries that ran while still waiting to connect.
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).catch((err) => {
    console.error("[mongo] initial connect failed:", err.message);
  });
} else {
  console.warn("[WARNING] MONGODB_URI is not set - birthday/mbti/poll/santa/voicemaster commands need it to work.");
}

client.once(Events.ClientReady, (c) => {
  console.log(`Ready!\n Logged in as ${c.user.tag}`);
  c.user.setPresence({
    activities: [{ name: "명령어는 /help", type: ActivityType.Playing }],
    status: "online",
  });
});

// Voicemaster join-to-create system: creates/cleans up personal temp voice channels.
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState).catch((err) => console.error("voiceStateUpdate handler error:", err));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() || interaction.isUserSelectMenu() || interaction.isModalSubmit()) {
      // Voicemaster control-panel buttons / select menus / modal submissions
      if (interaction.customId?.startsWith("vm:")) {
        await handleVoicemasterComponent(interaction);
      } else if (interaction.customId?.startsWith("pred:")) {
        // /예측 bet buttons + bet-amount modal submissions
        await handlePredictionComponent(interaction);
      }
    }
  } catch (error) {
    console.error(error);
    const payload = { content: "명령어를 실행하는 중 오류가 발생했습니다.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else if (typeof interaction.reply === "function") {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.BOT_TOKEN);
