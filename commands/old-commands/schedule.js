module.exports = {
  name: "공지",
  expectedArgs: "<Channel tag>",
  cooldown: 5,
  requiredPermission: ["ADMINISTRATOR"],
  execute(message, args, client) {
    if (message.member.roles.member._roles.includes("608328294957318165")) {
      const target = message.mentions.channels.first().id;
      let announce = "";

      for (let i = 0; i < args.length; i++) {
        if (i != 0) {
        const element = args[i] + " ";
        announce += element;
        }
      }

      client.channels
        .fetch(target, false)
        .then((channel) => {
          channel.send(announce);
        })
        .catch((err) => console.log("Error => ", err));
      console.log("This member have this role.");
    } else {
      message.channel.send("당신은 관리자가 아니라 사용 불가능합니다.");
      console.log("This member does not have this role.");
    }
  },
};
