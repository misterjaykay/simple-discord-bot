module.exports = {
	// name of command
	name: 'help',
	cooldown: 5,
	guildOnly: true,
	description: '도움말',
	execute(message, args) {
		message.channel.send('특별 마니또 명령어:' +
		"\n\`\`\`!참가\n!룰\n!기간\n!내마니또\n!참가자\n!귓 <내용>\`\`\`\n" +
		"Prefix 없는 명령어 (!없이 쓰는 명령어):" +
		"\n\`\`\`\n안녕\n잘자\n뭐먹을까 <한식/양식/중식/일식/분식>\n시카\`\`\`\n" +
		"Prefix 있는 명령어 (!필요한 명령어):" +
		"\`\`\`\n!!티어 <소환사명>\`\`\`");
	},
};