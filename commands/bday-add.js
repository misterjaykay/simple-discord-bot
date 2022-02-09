module.exports = {
  name: "생일추가",
  description: "Information about the arguments provided.",
  execute(message, args, client, mongoose) {
    console.log(message.id);
    const admin = "234086876061892608";
    if (message.author.id == admin) {
      if (args[0] != null && args[1] != null && args[2] != null) {
        client.users.fetch(args[0], false).then((user) => {
          console.log(user);
          return message.channel.send(
            "유저이름: " + user.username + " 생일: " + args[1] + "-" + args[2]
          );
        });
      } else {
        return message.channel.send(
          "제대로 입력되지 않았습니다. Ex. !생일추가 <유저> <월> <일>"
        );
      }
    } else {
      return message.channel.send(
        "당신은 이 명령어를 사용할 권한이 없습니다. (NO ADMIN)"
      );
    }
  },
};
