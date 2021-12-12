const db = require("../models");

module.exports = {
  name: "투표",
  description: "영화 투표 만드는 봇",
  execute(message, args, client, mongoose) {
    var { username } = message.author;
    const userpick = args[0] - 1;
    var replymsg = "현재 투표 결과입니다. \n";
    // console.log(username);
    if (!args.length) {
      message.channel.send("no arg");
    } else if (args.length > 1) {
      message.channel.send("too many arg");
    } else {
      //   console.log(args[0]);
      message.channel.send("correct");
      db.Poll.findOne({
        pollId: "919541015923294278",
      })
        .then((res) => {
          //   console.log(res);
          const value = res.choices[userpick];
          const id = res.choices[userpick].poll;
          //   console.log("value", value, id);
          db.Poll.updateOne(
            { "choices.id": userpick },
            { $set: { "choices.$.poll": id + 1 } }
          )
            .then((res) => console.log(res))
            .catch((err) => console.log(err));
        })
        .catch((err) => console.log(err));
      db.Poll.findOne({
        pollId: "919541015923294278",
      })
        .then((res) => {
        //   console.log("what", res);

          for (let i = 0; i < res.choices.length; i++) {
              replymsg += `\`\`\`${i}. ${res.choices[i].name} ${res.choices[i].poll}\n\`\`\``;
          }
          message.reply(replymsg);
        //   console.log(replymsg);
        })
        .catch((err) => console.log(err));
    }
  },
};
