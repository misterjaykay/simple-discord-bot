module.exports = {
  name: "생일",
  description: "Information about the arguments provided.",
  execute(message, args, client, mongoose) {
    console.log(message.id);
	console.log(message.author.id);
    const admin = "234086876061892608";
    if (message.author.id == admin) {
      if (!args.length) {
        return message.channel.send(
          `이 명령어는 명령어뒤 <ON> 혹은 <OFF> 가 붙어야 실행이됩니다. , ${message.author}!`
        );
      } else if (args[0] == "ON") {
        return message.channel.send("스위치 ON");
      } else if (args[0] == "OFF") {
        return message.channel.send("스위치 OFF");
      }
    } else {
      return message.channel.send(
        "당신은 이 명령어를 사용할 권한이 없습니다. (NO ADMIN)"
      );
    }

    message.channel.send(`First argument: ${args[0]}`);
  },
};
