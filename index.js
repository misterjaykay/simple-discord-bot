const fs = require('node:fs');
const path = require('node:path');

// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, Role, Guild, ChannelType, ActionRowBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

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

client.commands = new Collection();
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
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'myModal') {
        const favoriteColor = interaction.fields.getTextInputValue('favoriteColorInput');
        const hobbies = interaction.fields.getTextInputValue('hobbiesInput');
        console.log({ favoriteColor, hobbies });
		await interaction.reply({ content: 'Your submission was received successfully!' });
	}

    if (interaction.commandName == 'ahoho') {
		// Create the modal
		const modal = new ModalBuilder()
			.setCustomId('myModal')
			.setTitle('My Modal');

		// Add components to modal

		// Create the text input components
		// const favoriteColorInput = new TextInputBuilder()
		// 	.setCustomId('favoriteColorInput')
		//     // The label is the prompt the user sees for this input
		// 	.setLabel("What's your favorite color?")
		//     // Short means only a single line of text
		// 	.setStyle(TextInputStyle.Short);

        const favoriteColorInput = new SelectMenuBuilder()
            .setCustomId('select')
            .setPlaceholder('Nothing selected')
            .setMinValues(2)
            .setMaxValues(3)
            .addOptions([
                {
                    label: 'Select me',
                    description: 'This is a description',
                    value: 'first_option',
                },
                {
                    label: 'You can select me too',
                    description: 'This is also a description',
                    value: 'second_option',
                },
                {
                    label: 'I am also an option',
                    description: 'This is a description as well',
                    value: 'third_option',
                },
            ]);
        

		const hobbiesInput = new TextInputBuilder()
			.setCustomId('hobbiesInput')
			.setLabel("What's some of your favorite hobbies?")
		    // Paragraph means multiple lines of text.
			.setStyle(TextInputStyle.Paragraph);

		// An action row only holds one text input,
		// so you need one action row per text input.
		const firstActionRow = new ActionRowBuilder().addComponents(favoriteColorInput);
		const secondActionRow = new ActionRowBuilder().addComponents(hobbiesInput);

		// Add inputs to the modal
		modal.addComponents(firstActionRow, secondActionRow);

		// Show the modal to the user
		await interaction.showModal(modal);
	}
});

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.BOT_TOKEN);