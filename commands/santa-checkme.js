const db = require("../models");

module.exports = {
  // name of command
  name: "내마니또",
  cooldown: 5,
  guildOnly: true,
  description: "마니또 상대 확인용",
  execute(message, args, mongoose) {
    db.Person.find({
      username: message.author.username,
    })
      .then((res) => console.log(res, "found"))
      .catch((err) => console.log(err));
  },
};
