const db = require("../models");

module.exports = {
  name: "날짜투표확인",
  description: "영화 투표 만드는 봇",
  async execute(message, args, client, mongoose) {
    var { username } = message.author;
    const userpick = args[0] - 1;
    const startmsg = "\`\`\`현재 투표 결과입니다. \n";
    var middlemsg = "";
    const endmsg = "\`\`\`";

    await db.Poll.findOne({
      pollId: "921863696232353822",
    })
      .then((res) => {
        // console.log("what", res.choices[0].name);
        for (let j = 0; j < res.choices.length; j++) {
            // You need to fix this, for mobile view.
            middlemsg += `${j + 1}. ${res.choices[j].name} ${res.choices[j].poll}표\n\n`;
        }
        const result = startmsg + middlemsg + endmsg;
        message.reply(result);
      })
      .catch((err) => console.log(err));
    // message.reply(result);
    // console.log(replymsg);
  },
};
