const db = require("../models");

module.exports = {
  name: "영화투표만들기",
  description: "영화 투표 만드는 커맨드",
  execute(message, args, client, mongoose) {
    // console.log(message.id);
    let movieList = [];
    if (!args.length) {
      message.channel.send("no args");
    } else {
      for (let i = 0; i < args.length; i++) {
        const element = args[i];
        if (element.includes("-")) {
          // console.log("including works");
          const str = element.split("-");
          // console.log('value', str);
          const newStr = str.join(" ");
          movieList.push({id: i, name: newStr, poll: 0});
        } else {
          movieList.push({ id: i, name: element, poll: 0});
        }
      }
      //   console.log(movieList);
    }

    const poll = new db.Poll({
      pollId: message.id,
      choices: movieList,
    });

    poll
      .save()
      .then((res) => {
        console.log("Moive Poll has been created.", message.id, " is Poll ID\n", res);
        message.reply("감사합니다, 투표가 완성적으로 만들어졌습니다.");
      })
      .catch((err) => console.log(err));
  },
};
