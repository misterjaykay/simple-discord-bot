const db = require("../models");

module.exports = {
  name: "참가자",
  description: "시크릿 산타 & 마니또 멤버숫자 카운트 확인",
  execute(message, args, mongoose) {
    var user = message.author;
    console.log(message.id);

    var total = [];
    var numb = "";

    db.Person.find({})
      .then((res) => {
        numb = res.length;
        // console.log("before", res);
        for (let i = 0; i < res.length; i++) {
          total.push(res[i].userName);
        }
        // console.log("result", total);
        if (numb == 0) {
          message.reply(`현재 참가자수는 0명 입니다. 얼른 참가하세요!`);
        } else {
            // console.log(total);
          message.reply(
            `현재 참가자수는 ${numb}명 입니다. 얼른 참가하세요! \n 현재 참가자 명단: \n ${total.map(
              e => ' ' + e + '님' 
            )}`
          );
        }
      })
      .catch((err) => console.log(err));
  },
};
