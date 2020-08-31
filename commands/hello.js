module.exports = {
	// name of command
	name: 'helloooo',
	cooldown: 5,
	guildOnly: true,
	description: '안녕',
	execute(message, args) {
		message.channel.send('안녕하세요.');
	},
};