const db = require("../models");

module.exports = {
  name: "참가",
  description: "시크릿 산타 & 마니또 참가",
  execute(message, args) {
    const user = message.author;
    // console.log(message.id);
    // User {
    //     id: '234086876061892608',
    //     username: 'rikimaru',
    //     bot: false,
    //     discriminator: '7054',
    //     avatar: '270edc3dadf25f40cbe0b95145638543',
    //     flags: UserFlags { bitfield: 64 },
    //     lastMessageID: '908944046582542346',
    //     lastMessageChannelID: '639853557226668052'
    // }

    const person = new db.Person({
      userId: user.id,
      userName: user.username,
      userMessage: message.id,
    });

    var duplicate = [];

    db.Person.find({})
      .then((res) => {
        // console.log("before", res);
        if (res.length >= 1) {
          for (let i = 0; i < res.length; i++) {
            duplicate.push(res[i].userName);
          }
        }
        // console.log("result", duplicate);
        if (duplicate.length == 0) {
          // console.log("0 일때", duplicate.length)
          person
            .save()
            .then((res) => {
              console.log(`${res.userName} is saved to DB`); // Undefined
              message.reply(`${res.userName} 참가 신청해주셔서 감사합니다.`);
            })
            .catch((err) => console.log(err));
        } else if (duplicate.length > 0) {
          // console.log("0 보다 클때", duplicate.length)
          if (duplicate.find(e => e == message.author.username)) {
            message.reply("중복 참가는 불가능 합니다.");
          } else {
            person
            .save()
            .then((res) => {
              console.log(`${res.userName} is saved to DB`); // Undefined 
              message.reply(`${res.userName} 참가 신청해주셔서 감사합니다.`);
            })
            .catch((err) => console.log(err));
          }
        } else {
          message.reply("중복 참가는 불가능 합니다.");
        }
      })
      .catch((err) => console.log(err));
  },
};
