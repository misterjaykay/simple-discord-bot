module.exports = {
	name: 'user',
	description: '유저',
	execute(message, args) {
		message.channel.send(
            `유저의 이름: ${message.author.username}\n 유저 고유번호: ${message.author.id}`
          );
	},
};

// if (message.content === `${prefix}유저`) {
//     message.channel.send(
//       `유저의 이름: ${message.author.username}\n 유저 고유번호: ${message.author.id}`
//     );
//   } 