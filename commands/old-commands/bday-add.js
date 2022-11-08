const db = require("../models");

module.exports = {
  name: "생일추가",
  description: "Adding Birthdays to the DB.",
  execute(message, args, client, mongoose) {
    console.log(message.author.id);
    const messageUser = message.author.id;
    // const admin = 234086876061892608;
    // if (message.author.id == admin) {
      if (args[0] != null && args[1] != null) {
        if (args[2] != null) {
          return message.channel.send(
            "제대로 입력되지 않았습니다. Ex. !생일추가 <유저> <월> <일>"
          );
        }
        client.users.fetch(messageUser, false).then((user) => {
          const { username, id } = user;
          console.log(username, id);
          const birthday = new Date(`${args[0]}-${args[1]}`);
          const month = birthday.getMonth() + 1;
          const day = birthday.getDate();
          const birthdayObj = new db.Birthday({
            userId: id,
            userName: username,
            birthday: birthday,
          });
          db.Birthday.findOne({
            userId: id,
          })
            .then((res) => {
              console.log('this is res', res)
              if (res == null) {
                birthdayObj
                  .save()
                  .then((res) => console.log(res))
                  .catch((err) => console.log(err));
                return message.channel.send(
                  `등록되었습니다.\n\`\`\` 이름:${username} 생일:${month}월 ${day}일\`\`\``
                );
              } else {
                const { userId, userName, birthday, mbti } = res;
                console.log('birthday', birthday);
                const getMonth = birthday.getMonth() + 1;
                const getDate = birthday.getDate();
                return message.channel.send(
                  `이미 등록된 유저입니다\n\`\`\` 이름:${userName} 생일:${getMonth}월 ${getDate}일\`\`\``
                );
              }
            })
            .catch((err) => console.log(err));
        });
      } else {
        return message.channel.send(
          "제대로 입력되지 않았습니다. Ex. !생일추가 <유저> <월> <일>"
        );
      }
    // } else {
    //   return message.channel.send(
    //     "당신은 이 명령어를 사용할 권한이 없습니다. (NO ADMIN)"
    //   );
    // }
  },
};
