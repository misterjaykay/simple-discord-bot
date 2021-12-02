const db = require("../models");

module.exports = {
  name: "귓",
  description: "whisper",
  execute(message, args, client, mongoose) {
    const user = message.author;
    db.Person.findOne({
      userId: user.id,
    })
      .then((res) => {
        // console.log(res);
        const target = res.santaId;
        // console.log(target);
        let userMsg = "";
        for (let i = 0; i < args.length; i++) {
          const element = args[i] + " ";
          userMsg += element;
        }
        if (res.santaId != null) {
          client.users.fetch(target, false).then((user) => {
            user.send(
              `당신의 마니또가 보낸 메세지 입니다.\`\`\`${userMsg}\`\`\``
            );
            console.log("sent message", userMsg);
          })
          .catch(err => console.log(err));
        } else {
          message.channel.send("마니또가 없네요? 왜지?");
        }
      })
      .catch((err) => console.log(err));
  },
};
