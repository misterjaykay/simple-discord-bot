const db = require("../models");

module.exports = {
  name: "귓",
  description: "whisper",
  execute(message, args, client, mongoose) {
    const user = message.author;
    db.Person.find({
      userId: user.id,
    })
      .then((res) => console.log(res)) 
      .catch((err) => console.log(err));

    let userMsg = "";
    for (let i = 0; i < args.length; i++) {
      const element = args[i] + " ";
      userMsg += element;
    }
    console.log(userMsg);
    message.reply(userMsg);
    client.users.fetch("234086876061892608", false).then((user) => {
      user.send(`\`\`\`당신의 마니또가 보낸 메세지 입니다.\`\`\`\n ${userMsg}`);
    });
  },
};
