const axios = require("axios");
require("dotenv").config();

module.exports = {
  name: "티어",
  description: "유저가 롤 검색할수 있게 만든 명령어",
  execute(message, args) {
    if (!args.length) {
      return message.channel.send(
        `소환사명을 입력해주셔야 합니다.\`예. !!롤 (소환사명)\`, ${message.author}!`
      );
    } else {
      const baseUrl =
        "https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/";
      const addUrl = "?api_key=";
      const apiKey = process.env.LOL_KEY;
      const statsUrl =
        "https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/";

      axios
        .get(baseUrl + args[0] + addUrl + apiKey)
        .then((res) =>
          // console.log('res\n',res.data)
          axios
            .get(statsUrl + res.data.id + addUrl + apiKey)
            .then((res) => {
              // console.log(res.data.length);
              if (res.data.length > 0) {
                // console.log("data exists");
                message.channel.send(
                  `\`\`\`현재 ${res.data[0].summonerName} 소환사님의\n솔로랭크는 ${res.data[0].tier} ${res.data[0].rank} ${res.data[0].leaguePoints}LP\n자유랭크는 ${res.data[1].tier} ${res.data[1].rank} ${res.data[1].leaguePoints}LP\n입니다.\`\`\``
                );
              } else {
                // console.log("no data");
                message.channel.send(
                  `해당 소환사 ${args[0]} 는 솔로랭크/자유랭크를 한 기록이없습니다.`
                );
              }
            })
            .catch((err) => {
              console.log(err);
              // console.log("Error Message\n", err.response.status, err.response.statusText);
              message.channel.send(
                `이 에러메세지를 받으시면 관리자에게 알려주세요.\n\`에러메세지: ${err.response.status} ${err.response.statusText}\``
              );
            })
        )
        .catch((err) => {
          console.log(err);
          // console.log("Error Message\n", err.response.status, err.response.statusText);
          message.channel.send(
            `해당 소환사는 존재 하지않습니다.\n**해당 검색은 NA서버만 가능합니다**\n\n\`에러메세지: ${err.response.status} ${err.response.statusText}\``
          );
        });
    }
  },
};

// if (message.content === `${prefix}유저`) {
//     message.channel.send(
//       `유저의 이름: ${message.author.username}\n 유저 고유번호: ${message.author.id}`
//     );
//   }
