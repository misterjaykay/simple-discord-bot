const db = require("../models");

module.exports = {
  name: "참가자",
  description: "시크릿 산타 & 마니또 멤버숫자 카운트 확인",
  execute(message, args, mongoose) {
    var user = message.author;
    console.log(message.id);

    var total = [];
    var numb = "";

    var steam = 

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
            //  rikimaru님, Mingtodak님, Jesyka님, 은하수님, Swanii님, RP님, Bingsu님, Dotori님, harrykim님, Droo님, rekuel님, jjinramen님
          message.reply(
            `현재 참가자수는 ${numb}명 입니다. 얼른 참가하세요! \n 현재 참가자 명단: \n ${total.map(
              e => ' ' + e + '님' 
            )}\n 
            \`\`\`rikimaru님 -  https://steamcommunity.com/id/uramikir/\n\n` +
            "Mingtodak님 -  https://steamcommunity.com/id/mcho0614/\n\n" +
            "Jesyka님 -  https://steamcommunity.com/profiles/76561198986942804/ -주의- 이사람은 비공개라서 안보입니다.\n\n" +
            "은하수님 -  https://steamcommunity.com/id/Candyowner/\n\n" +
            "Swanii님 -  https://steamcommunity.com/profiles/76561198130516577/\n\n" +
            "RP님 -  https://steamcommunity.com/id/red_propaganda/\n\n" +
            "Bingsu님 -  공개 원치 않으심. 마니또는 따로 물어보셔야합니다.\n\n" +
            "Dotori님 -  https://steamcommunity.com/id/dotorisan/\n\n" +
            "harrykim님 -  https://steamcommunity.com/profiles/76561198079896019/\n\n" +
            "Droo님 -  https://steamcommunity.com/id/33skillzone/\n\n" +
            "rekuel님 -  https://steamcommunity.com/id/benny0129/\n\n" +
            "jjinramen님 -  https://steamcommunity.com/profiles/76561198076517657/ \`\`\`"
          );
        }
      })
      .catch((err) => console.log(err));
  },
};
