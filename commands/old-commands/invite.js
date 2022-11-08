module.exports = {
  name: "현재 커맨드 없음",
  description: "Invites people who wants to play a game user mentioned.",
  execute(message, args) {
    if (!args.length) {
      return message.channel.send(
        `초대할 게임을 말해야 합니다, ${message.author}!`
      );
    } else if (args[0] === "롤") {

      var dataObj = message.member.roles.member._roles; // displaying what role user have
      if (!dataObj.includes("749687210013491303")) {
        message.channel.send("이 명령어를 실행시킬수 있는 권한이 없습니다.");
      } else {
        // channel creation
        message.guild.channels
          .create(`${args[0]}`, { type: "voice", parent: "639853466998800392" })
          .then((res) => {
            console.log(
              `Channel name:${res.name}(type:${res.type}) has been successfully created.`
            );
          })
          .catch(console.error);
        
        // invitation message sent
        console.log(message.content);
        message.channel
          .send(`게임명: ${args[0]}\n하실분을 모집합니다.`)
          .then(() => message.react("⭕"))
          .then(() => message.react("❌"))
          .catch(() => console.error("One of the emojis failed to react."));

        if (message.content === "이 명령어를 실행하겠습니다.") {
          console.log("확인");
        }
      }
      return message.channel.send("bar");
    }

    message.channel.send(`First argument: ${args[0]}`);
  },
};
