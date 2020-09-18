const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const role = new Discord.Role();
const guild = new Discord.Guild();
// const presence = new Discord.Presence();

client.commands = new Discord.Collection();
const { prefix, token } = require("./config.json");
const axios = require("axios");
const express = require("express");
const app = express();
// require("./routes/api-routes.js")(app);
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
        name: "명령어는 !!help", //The message shown
        type: "PLAYING", //PLAYING: WATCHING: LISTENING: STREAMING:
      },
    })
    .then(console.log("Starting Bot"))
    .catch(console.error);
});

// receiving commands/messages here
client.on("message", (message) => {

  if (message.content === "안녕") {
    message.channel.send(
      `안녕하세요 ${message.author}님`
    )
  }

  if (message.content === "잘자") {
    message.channel.send(
      `좋은 꿈 꾸세요 ${message.author}님`
    )
  }

  if (message.content.startsWith("뭐먹을까")) {
    const argu = message.content.trim().split(/ +/);
    console.log('1',argu[0],'\n2',argu[1]);

    const numOneArr =
    ["갈비탕","순댓국","닭볶음탕","수제비","백숙","미역국","떡국","부대찌개","순두부찌개","김치찌개","갈비찜","카레"];
    const numTwoArr = 
    ["연어 스테이크","리조또","피자","봉골레 스파게티","크림 파스타","까르보나라"];
    const numThreeArr = 
    ["마파두부","꿔바로우","해물누룽지탕","짜장면","짬뽕","우육탕면","깐풍기"];
    const numFourArr = 
    ["돈부리","오니기리","우동","야끼소바","라멘","오코노미야키","타코야키","샤부샤부","스키야키","초밥","사시미","야키토리","카라아게"];
    const numFiveArr = 
    ["떡볶이","김말이","모듬튀김","오뎅","핫도그","순대","돈가스","잔치국수","라면","쫄면","만두","볶음밥"];
    let randomFood;

    switch(argu[1]) {
      
      case "한식": 
      randomFood = Math.floor(Math.random() * numOneArr.length);
      message.channel.send(`${numOneArr[randomFood]}는 어떠신가요?`)
        break;

      case "양식": 
      randomFood = Math.floor(Math.random() * numTwoArr.length);
      message.channel.send(`${numTwoArr[randomFood]}는 어떠신가요?`)
        break;

      case "중식": 
      randomFood = Math.floor(Math.random() * numThreeArr.length);
      message.channel.send(`${numThreeArr[randomFood]}는 어떠신가요?`)
        break;

      case "일식": 
      randomFood = Math.floor(Math.random() * numFourArr.length);
      message.channel.send(`${numFourArr[randomFood]}는 어떠신가요?`)
        break;

      case "분식": 
      randomFood = Math.floor(Math.random() * numFiveArr.length);
      message.channel.send(`${numFiveArr[randomFood]}는 어떠신가요?`)
        break;

      default: message.channel.send("한식, 양식, 중식, 일식, 분식 중에 알려주셔야 답을 드릴수 있어요ㅠㅡㅠ")
        break;
    }
  }
  


  // channel creation
  if (message.content === "채널111" ) {
    message.guild.channels.create('test', { type: "text", 
     parent: "604455432324644891" })
    .then((res) => {
      console.log(`Channel name:${res.name}(type:${res.type}) has been successfully created.`);
    })
    .catch(console.error)
  }
  
  // prefix 없는 command
  if (message.content.startsWith("시카")) {
    message.channel.send("네에에");
  }

  // DM 을 거절하는 답장
  if ((message.channel.type === "dm") & (!message.author.bot)) {
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
