const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const role = new Discord.Role();
const guild = new Discord.Guild();
// const presence = new Discord.Presence();

client.commands = new Discord.Collection();
const { prefix, token } = require("./config.json");
const e = require("express");
require("dotenv").config();

const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

const cooldowns = new Discord.Collection();

client.once("ready", () => {
  console.log("Ready!");
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user
    .setPresence({
      status: "online", //You can show online, idle....
      activity: {
        name: "도움이 필요할떈 !!help", //The message shown
        type: "WATCHING", //PLAYING: WATCHING: LISTENING: STREAMING:
      },
    })
    .then(console.log("Starting Bot"))
    .catch(console.error);
});

client.on("message", (message) => {
  // prefix 없는 command
  if (message.content.startsWith("시카")) {
    message.channel.send("네에에");
  }

  // DM 을 거절하는 답장
  if (message.channel.type === "dm" & (!message.author.bot) ) {
    return message.reply("죄송합니다. 저는 현재 DM 을 받지 않고 있으며, DM 으로 명령어를 실행할수 없습니다. 문의사항이 있으면 rikimaru님께 DM 부탁드리겠습니다.");
  }
  
  // 공지사항 // bot posts a notice message in fixed channel.
  if (message.content === "TO BE UPDATED SOON") {
    client.channels.fetch(`639853557226668052`)
    .then(channel => channel.send(`안녕히가세요`))
    .catch(console.error);
  }

  // role checker to what roles does user have.
  if (message.content === "role check") {
    console.log('another testing:\n', message.member.roles.member._roles);
    if (message.member.roles.member._roles.includes("749687210013491303")) {
      console.log("This memeber has this role.")
    } else { 
      console.log("Does not have this role.")
    }
  }

  // 여기서 부터는 prefix 없이는 통과 못함
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find(
      (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
    );

  if (!command) return;

  if (command.guildOnly && message.channel.type === "dm") {
    return message.reply("죄송합니다. 저는 현재 DM 을 받지 않고 있으며, DM 으로 명령어를 실행할수 없습니다. 문의사항이 있으면 rikimaru님께 DM 부탁드리겠습니다.");
  }

  if (command.args && !args.length) {
    let reply = `You didn't provide any arguments, ${message.author}!`;

    if (command.usage) {
      reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
    }

    return message.channel.send(reply);
  }

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `현재 ${timeLeft.toFixed(0)}초의 쿨다운이\`${
          command.name
        }\` 명령어에 있습니다. 나중에 사용해주세요.`
      );
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("there was an error trying to execute that command!");
  }
});

client.login(process.env.BOT_TOKEN);
