const db = require("../models");

module.exports = {
  name: "투표확인",
  description: "영화 투표 만드는 봇",
  async execute(message, args, client, mongoose) {
    var { username } = message.author;
    const userpick = args[0] - 1;
    var replymsg = "현재 투표 결과입니다. \n";

    await db.Poll.findOne({
      pollId: "919540067964432385",
    })
      .then((res) => {
        // console.log("what", res.choices[0].name);
        for (let i = 0; i < res.choices.length; i++) {
            replymsg += `\`\`\`${res.choices[i].name}: ${res.choices[i].poll}\n\`\`\``;
        }
      })
      .catch((err) => console.log(err));
    message.reply(replymsg);
    // console.log(replymsg);
  },
};
