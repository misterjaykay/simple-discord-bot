const db = require("../models");

module.exports = {
  // name of command
  name: "내마니또",
  cooldown: 5,
  guildOnly: true,
  description: "마니또 상대 확인용",
  execute(message, args, mongoose, client) {
    const { id } = message.author;
    db.Person.findOne({
      userId: id,
    })
      .then((res) => {
        db.Person.findOne({
          userId: res.santaId,
        })
          .then((res) => {
            if (res.santaId != null) {
              client.users.fetch(res.userId, false).then((user) => {
                user.send(
                  `당신의 마니또는` +
                    `\`\`\`${res.userName}\`\`\`` +
                    "마니또의 소원은\n" +
                    `\`\`\`${
                      res.santaGift != null ? res.santaGift : "없습니다"
                    }\`\`\`` +
                    "입니다."
                );
                message.channel.send("귓속말로 보내드렸습니다.");
                console.log(res.santaGift, "found");
              });
            } else {
              message.channel.send("당신의 마니또는 없습니다.");
            }
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  },
};
