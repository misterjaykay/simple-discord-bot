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
  if ((message.channel.type === "dm") & !message.author.bot) {
    return message.reply(
      "죄송합니다. 저는 현재 DM 을 받지 않고 있으며, DM 으로 명령어를 실행할수 없습니다. 문의사항이 있으면 rikimaru님께 DM 부탁드리겠습니다."
    );
  }

  // DM 보내는 command
  // client.users.cache.get('<id>').send('<message>');

  // 공지사항 // bot posts a notice message in fixed channel.
  // Only admins can run this commands/arguments
  if (message.member.roles.member._roles.includes("749687210013491303")) {
    if (message.content === "공지사항") {
      client.channels
        .fetch(`673382653730357248`)
        .then((channel) =>
          channel.send(
            `여러분 안녕하세요!\n` +
              `여러분 다름이 아니라 현재 제시카 BOT 을 제작중에 있습니다.\n` +
              `비록 다른 봇들보다는 대단한 봇이 될것 같진 않으나\n` +
              `그래도 혹시나 여러분들이 이런 기능이 있었으면 좋겠다 라는 의견을 받고싶어 공지사항을 올립니다.\n` +
              `혹시나 의견이 있으신분은 <@${message.author.id}>에게 DM을 보내주시면 감사하겠습니다.`
          )
        )
        .catch(console.error);
    }
    if (message.content === "답변ㅇㅇ") {
      client.channels
        .fetch(`673382653730357248`)
        .then((channel) => channel.send(`알겠습니다.`))
        .catch(console.error);
    }
    if (message.content === "답변ㄴㄴ") {
      client.channels
        .fetch(`673382653730357248`)
        .then((channel) => channel.send(`안됩니다.`))
        .catch(console.error);
    }
  } else {
    message.reply("당신에게는 해당 권한이 없습니다.");
  }

  // role checker to see what roles does user have.
  if (message.content === "role check") {
    console.log("another testing:\n", message.member.roles.member._roles);
    if (message.member.roles.member._roles.includes("749687210013491303")) {
      console.log("This memeber has this role.");
    } else {
      console.log("Does not have this role.");
    }
  }

  // from here, you need prefix to pass this commands.
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
    return message.reply(
      "죄송합니다. 저는 현재 DM 을 받지 않고 있으며, DM 으로 명령어를 실행할수 없습니다. 문의사항이 있으면 rikimaru님께 DM 부탁드리겠습니다."
    );
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
