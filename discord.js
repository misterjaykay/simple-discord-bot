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

client.on("ready", () =>{
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({
      status: "online",  //You can show online, idle....
      activity: {
          name: "도움이 필요할떈 !!help",  //The message shown
          type: "WATCHING" //PLAYING: WATCHING: LISTENING: STREAMING:
      }
  }).then(console.log("Starting Bot"))
  .catch(console.error);
});;

client.on("message", (message) => {
  if (message.content === "유저확인") {

    var data = JSON.stringify(message.member.roles.guild.roles.cache, null, 2); // display datas

    var dataObj = message.member.roles.member._roles; // displaying what role user have
  
    if (dataObj.includes('749687210013491303') === false) {
      message.channel.send('이 명령어를 실행시킬수 있는 권한이 없습니다.');
    }
    else {
      console.log(message);
      message.channel.send('이 명령어를 실행하겠습니다.')
      .then(() => message.react('😄'))
      .catch(() => console.error('One of the emojis failed to react.'));
    
     
    if (message.content === '이 명령어를 실행하겠습니다.') {
      console.log("확인");
    }
      
      
      // function reactTimer() {
      //     if (message.content === '이 명령어를 실행하겠습니다.') {
      //       console.log('working on react');
      //       message.react('😄')
      //       .then(() => message.react(':x:'))
      //       .catch(() => console.error('One of the emojis failed to react.'));
      //     }
      //     else {
      //       console.log('too fast');
      //     }
      // }
      // reactTimer();
    }
  }

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
    return message.reply("I can't execute that command inside DMs!");
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
        `please wait ${timeLeft.toFixed(
          1
        )} more second(s) before reusing the \`${command.name}\` command.`
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
