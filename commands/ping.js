const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	hidden: true, // 현재 사용되지 않아 숨김 처리 (2026-07-30)
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
};