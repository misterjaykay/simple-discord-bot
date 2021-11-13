

module.exports = {
  name: "초대",
  guildOnly: true,
  description: "Invites people who wants to play a game user mentioned.",
  execute(message, args) {
    var dataObj = message.member.roles.member._roles; // displaying what role user have
    if (!dataObj.includes("749687210013491303")) {
      message.channel.send("이 명령어를 실행시킬수 있는 권한이 없습니다.");
    } else {
      if (!args.length) {
        return message.channel.send(
          `초대할 게임을 말해야 합니다, ${message.author}!`
        );
      } else if (args[0]) {
        switch (args[0]) {
          case "롤":
            message.channel.send(`<@&668342413110280194>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "파스트":
            message.channel.send(`<@&769411358541348865>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "영원회귀":
            message.channel.send(`<@&766816114482872361>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "어몽어스":
            message.channel.send(`<@&769803570614632458>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "굶지마":
            message.channel.send(`<@&769417112208015361>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "동숲":
            message.channel.send(`<@&769677499427979284>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "동물의숲":
            message.channel.send(`<@&769677499427979284>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          case "테이블탑":
            message.channel.send(`<@&770486652224143362>`);
            message.channel.send(`게임명: ${args[0]}\n하실분을 모집합니다.`);
            break;
          default:
            return;
        }
      }
    }
  },
};
