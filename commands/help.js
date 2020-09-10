module.exports = {
	// name of command
	name: 'help',
	cooldown: 5,
	guildOnly: true,
	description: '도움말',
	execute(message, args) {
		message.channel.send('도움말은 현재 준비중입니다.');
	},
};