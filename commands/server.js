module.exports = {
	name: 'server',
	description: '서버',
	execute(message, args) {
		message.channel.send(
            `해당서버의 이름은 ${message.guild.name}\n현재 참여인원수는 ${message.guild.memberCount}명입니다.`
          );
	},
};
