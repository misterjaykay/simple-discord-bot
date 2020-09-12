module.exports = {
  // name of command
  name: "답변",
  cooldown: 5,
  guildOnly: true,
  description: "도움말",
  execute(message, args) {
    if (args[0] === "답변ㅇㅇ") {
      client.channels
        .fetch(`${args[1]}`)
        .then((channel) => channel.send(`알겠습니다.`))
        .catch(console.error);
    }
    if (args[0] === "답변ㄴㄴ") {
      client.channels
        .fetch(`${args[1]}`)
        .then((channel) => channel.send(`안됩니다.`))
        .catch(console.error);
    }
    message.channel.send(
      `답변은 ${args[1]}채널에 ${args[0]}이라는 내용으로 보내집니다.`
    );
  },
};

// Client is not defined.