const fs = require("fs");
const path = require('node:path');
const Discord = require("discord.js");

// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, ActivityType, Role, Guild, ChannelType, PermissionFlagsBits } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [    
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ] });
// const role = new Discord.Role();
// const guild = new Discord.Guild();
// const member = new Discord.GuildMember();
// const presence = new Discord.Presence();

client.commands = new Discord.Collection();
const { prefix, token } = require("./config.json");
const axios = require("axios");
const express = require("express");
const app = express();
require("dotenv").config();

const mongoose = require("mongoose");

// mongoose.connect("mongodb://localhost/discord", {
// mongoose
//   .connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then((res) => {
//     console.log("Connected to DB");
//   })
//   .catch((err) => {
//     console.log(err);
//   });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

client.once(Events.ClientReady, c => {
	console.log(`Ready!\n Logged in as ${c.user.tag}`);
});

client.on(Events.ClientReady, c => {
  // ActivityType: Competing, Listening, Playing, Streaming, Watching
  client.user.setPresence({
    activities: [{ name: `명령어는 !!!help`, type: ActivityType.Playing }], 
    status: 'online',
  });
});

client.on('voiceStateUpdate', async (oldUser, newUser) => {
    let mainCatagory = '600398231599579168';
    let mainChannel = '300164378429358080';
    let temp;
    // console.log(newUser.id)

    const user = await client.users.fetch(newUser.id).catch(() => null);
    if (!user) console.log("That user is not available");
    else console.log(user);

    if(newUser.channelId == mainChannel){
        console.log("working");
        newUser.guild.channels.create({
            name: `${user.username}'s Channel`,
            type: ChannelType.GuildVoice,
            parent: 600398231599579168
        })
        .then(temporary => {
            temp = temporary
            temporary.setParent(mainCatagory)
            .then(() => newUser.setVoiceChannel(temporary.id))
        }).catch(err =>{
            console.error(err);
        })
    }
    if(newUser.channel.members.size == 0){temp.delete()};
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content == 'password') {
        message.delete();
        const VCchannel = message.guild.channels.cache.find(channel => channel.name === 'afk');
        message.member.voice.setChannel(VCchannel).catch(err => console.log(err));
    }
    if (message.content == 'trybest') {
        var author = message.author.username;
        var chName = `${author}'s Channel`
        let result;
        message.delete();
        await message.guild.channels.create({
            name: chName,
            type: ChannelType.GuildVoice,
            parent: '600398231599579168',
            // permissionOverwrites: [
            //     {
            //         id: message.author.id,
            //         deny: [PermissionFlagsBits.ViewChannel],
            //     }
            // ]
        }).then(res => {
            result = res;
            setTimeout(() => {
                console.log("Delayed for 2 second.");
                console.log(chName);
                const VCchannel = message.guild.channels.cache.find(channel => channel.name === chName);
                message.member.voice.setChannel(VCchannel).catch(err => console.log(err));
              }, 2000)
        }).catch(console.error());
        if(newMember.voiceChannel.members.size === 0){temp.delete()};
    }
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(process.env.BOT_TOKEN);