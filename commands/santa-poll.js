const db = require("../models");

module.exports = {
  name: "날짜투표",
  description: "마니또 끝나는 날짜 투표",
  async execute(message, args, client, mongoose) {
    let userArr = [];
    const userpick = args[0] - 1;
    const startmsg = "```현재 투표 결과입니다. \n";
    var middlemsg = "";
    const endmsg = "```";

    await db.Person.find({})
      .then((res) => {
        // console.log(res);
        for (let i = 0; i < res.length; i++) {
          userArr.push(res[i].userId);
        }
        // console.log(userArr);
      })
      .catch((err) => console.error(err));

    const { id } = message.author;
    const { username } = message.author;

    if (userArr.includes(id)) {
      if (!args.length) {
        message.channel.send(
          "투표 하실 번호를 입력해주세요. 예시) 날짜투표 <번호>"
        );
      } else if (args.length > 1) {
        message.channel.send(
          "번호를 제대로 입력 하지 않았습니다. 제대로 입력해주세요. 예시) 날짜투표 <번호>"
        );
      } else {
        db.Poll.findOne({
          pollId: "921863696232353822", // need pollId
        })
          .then((res) => {
            const value = res.choices[userpick];
            const id = res.choices[userpick].poll;
            db.Poll.updateOne(
              { "choices.id": userpick },
              { $set: { "choices.$.poll": id + 1 } }
            )
              .then((res) => {
                db.Poll.findOne({
                  pollId: "921863696232353822", // need pollId
                })
                  .then((res) => {
                    for (let j = 0; j < res.choices.length; j++) {
                      middlemsg += `${j + 1}. ${res.choices[j].name} ${
                        res.choices[j].poll
                      }\n\n`;
                    }
                    const result = startmsg + middlemsg + endmsg;
                    message.reply(result);
                  })
                  .catch((err) => console.error(err));
              })
              .catch((err) => console.error(err));
          })
          .catch((err) => console.error(err));
      }
    } else {
      message.reply("당신은 마니또 그룹에 속해있지 않습니다.");
    }
  },
};
