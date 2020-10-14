module.exports = {
	// name of command
	name: 'help',
	cooldown: 5,
	guildOnly: true,
	description: '도움말',
	execute(message, args) {
		message.channel.send('현재 사용가능한 도움말:\n\`\`\`prefix 없는 명령어\n안녕, 잘자, 뭐먹을까 <한식/양식/중식/일식/분식>, 시카\`\`\`\`\`\`prefix 있는 명령어\n!!티어 <소환사명>\`\`\`현재 더 많은 명령어를 준비중입니다.');
	},
};