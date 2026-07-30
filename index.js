require("dotenv").config();

const fs = require("fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { Client, Collection, Events, GatewayIntentBits, ActivityType } = require("discord.js");

const { handleVoiceStateUpdate } = require("./voicemaster/voiceStateHandler");
const { handleVoicemasterComponent } = require("./voicemaster/componentHandler");
const { handlePredictionComponent } = require("./prediction/componentHandler");
const { handlePetComponent } = require("./pet/componentHandler");
const { rearmScheduledLocks } = require("./prediction/predictionService");
const { startVoicePointsInterval, rearmVoiceEventReverts } = require("./points/voicePointsService");
const { rearmScheduledDraws } = require("./points/lotteryDrawService");
const { awardChatPoints } = require("./points/chatPointsService");
const { startBirthdayCheckInterval } = require("./birthday/birthdayPointsService");
const { handleWordleResultsMessage } = require("./wordle/wordlePointsService");

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
    // `deprecated` = dead/replaced code kept only as a stub. `hidden` = fully
    // built and working, just not exposed as a usable command yet (e.g. a
    // feature whose design isn't finalized). Both are skipped the same way.
    if (command.deprecated || command.hidden) continue;

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

  mongoose.connection.on("connected", () => {
    console.log("[mongo] connected");

    // Drop/rebuild indexes to match the current schemas. Needed because Mongoose's
    // default autoIndex only ADDS indexes declared in a schema - it never removes
    // ones left over from an older schema version. voicemasterconfigs used to have
    // a unique index on guildId (one trigger channel per guild); the schema was
    // changed to allow multiple triggers per guild (unique on triggerChannelId
    // instead), but the stale guildId unique index stayed in the actual DB and kept
    // rejecting inserts with E11000 duplicate key errors. syncIndexes() reconciles
    // every model's indexes with its schema on every boot, so this class of drift
    // can't happen again as the schemas evolve.
    for (const model of Object.values(require("./models"))) {
      model.syncIndexes().catch((err) => console.error(`[mongo] syncIndexes failed for ${model.modelName}:`, err.message));
    }
  });
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

  // Re-arm any /예측 생성 ... 시간: auto-lock timers that were pending when the
  // process last stopped (e.g. Railway redeploy/restart) - without this a
  // restart would silently lose the deadline and the prediction would never
  // auto-lock.
  rearmScheduledLocks(c).catch((err) => console.error("[prediction] rearm failed:", err));

  if (process.env.MONGODB_URI) {
    startVoicePointsInterval(c);
    rearmVoiceEventReverts().catch((err) => console.error("[points] rearm voice events failed:", err));
    startBirthdayCheckInterval(c);
    // Re-arm any pending weekly /복권 추첨 draws (see commands/lottery.js) that
    // were scheduled when the process last stopped.
    rearmScheduledDraws(c).catch((err) => console.error("[lottery] rearm failed:", err));
  }
});

// Voicemaster join-to-create system: creates/cleans up personal temp voice channels.
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState).catch((err) => console.error("voiceStateUpdate handler error:", err));
});

client.on(Events.MessageCreate, (message) => {
  if (!message.guild || !process.env.MONGODB_URI) return;

  if (message.author.bot) {
    // Daily Wordle results message ("Here are yesterday's results: 4/6: @user
    // ...") - awards points to everyone who solved it. No-ops for messages
    // from any other bot or a non-results Wordle message.
    handleWordleResultsMessage(message).catch((err) => console.error("[wordle] handler error:", err.message));
    return;
  }

  // Chat is also allowed to earn points (capped + cooldown-limited, see
  // chatPointsService.js) so people aren't only rewarded for sitting in voice.
  awardChatPoints(message.guild.id, message.author).catch((err) => console.error("[points] chat award failed:", err.message));
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
      } else if (interaction.customId?.startsWith("pet:")) {
        // /펫입양 다시뽑기/확정 buttons
        await handlePetComponent(interaction);
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
