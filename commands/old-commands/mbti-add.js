const db = require("../models");

module.exports = {
  name: "mbti",
  description: "Adding MBTI Personalities to the DB.",
  execute(message, args, client, mongoose, guild) {
    if (args[0] != null) {
      // if (args[2] != null) {
      //   return message.channel.send(
      //     "제대로 입력되지 않았습니다. 입력 예: !MBTI <MBTI> 예시: !MBTI ISFJ"
      //   );
      // }
      const mbti = args[0].toUpperCase();
      console.log(mbti);

      const arr = [
        "ISFJ",
        "ESFJ",
        "INFJ",
        "ENFJ",
        "ISTJ",
        "ESTJ",
        "INTJ",
        "ENTJ",
        "INFP",
        "ENFP",
        "INTP",
        "ENTP",
        "ISFP",
        "ESFP",
        "ISTP",
        "ESTP",
      ];

      if (arr.includes(mbti)) {
        client.users.fetch(message.author.id, false).then((user) => {
          const { username, id } = user;
          const mbtiObj = new db.Birthday({
            userId: id,
            userName: username,
            mbti: mbti,
          });
          db.Birthday.findOne({
            userId: id,
          })
            .then((res) => {
              console.log("this is res", res);
              if (res == null) {
                mbtiObj
                  .save()
                  .then((res) => console.log(res))
                  .catch((err) => console.log(err));

                // Getting role using their role id
                // let role = message.guild.roles.cache.get("859036607989153853");

                // Finding Role Using role names.
                let role = message.guild.roles.cache.find(
                  (r) => r.name == mbti
                );
                // let role = message.guild.roles.cache.find();
                // let role = guild.roles.fetch('Valorant');
                // || await guild.roles.fetch('ROLEID');
                console.log("role check", role);
                message.member.roles.add(role.id);
                message.react("✅");

                // Assigning or Removing their roles using command
                // if (args[0] == 'a') {
                //     message.member.roles.add(role.id);
                //     message.react('✅');
                // }
                // if (args[0] == 'r') {
                //     message.member.roles.remove(role.id);
                //     message.react('✅');

                // var rolex = message.guild.roles.fetch("821592780404817931").then(res => console.log(res.id));
                // console.log("result", user, rolex);
                // user.roles.addRole(rolex);
                return message.channel.send(
                  `등록되었습니다.\n\`\`\` 이름:${username} MBTI:${mbti}\`\`\``
                );
              } else {
                const { userId, userName, birthday, mbti } = res;
                return message.channel.send(
                  `이미 등록된 유저입니다\n\`\`\` 이름:${userName} MBTI:${mbti}\`\`\``
                );
              }
            })
            .catch((err) => console.log(err));
        });
      } else {
        return message.channel.send(
          "MBTI가 제대로 입력되지 않았습니다. (Ex. ISFP ENTP) 2"
        );
      }
    }

    if (args[0] != null && args[1] != null) {
      const admin = 234086876061892608 || 521185243177287681;
      // if (args[2] != null) {
      //   return message.channel.send(
      //     "제대로 입력되지 않았습니다. 입력 예: !MBTI <MBTI> 예시: !MBTI ISFJ"
      //   );
      // }
      if (message.author.id == admin) {
        const mbti = args[0].toUpperCase();
        console.log(mbti);
        const arr = [
          "ISFJ",
          "ESFJ",
          "INFJ",
          "ENFJ",
          "ISTJ",
          "ESTJ",
          "INTJ",
          "ENTJ",
          "INFP",
          "ENFP",
          "INTP",
          "ENTP",
          "ISFP",
          "ESFP",
          "ISTP",
          "ESTP",
        ];
        if (arr.includes(mbti)) {
          client.users.fetch(args[0], false).then((user) => {
            const { username, id } = user;
            const mbtiObj = new db.Birthday({
              userId: id,
              userName: username,
              mbti: mbti,
            });
            db.Birthday.findOne({
              userId: message.author.id,
            })
              .then((res) => {
                console.log("this is res", res);
                if (res == null) {
                  mbtiObj
                    .save()
                    .then((res) => console.log(res))
                    .catch((err) => console.log(err));

                  // Getting role using their role id
                  // let role = message.guild.roles.cache.get("859036607989153853");

                  // Finding Role Using role names.
                  let role = message.guild.roles.cache.find(
                    (r) => r.name == mbti
                  );
                  // let role = message.guild.roles.cache.find();
                  // let role = guild.roles.fetch('Valorant');
                  // || await guild.roles.fetch('ROLEID');
                  console.log(role);
                  message.member.roles.add(role.id);
                  message.react("✅");

                  // Assigning or Removing their roles using command
                  // if (args[0] == 'a') {
                  //     message.member.roles.add(role.id);
                  //     message.react('✅');
                  // }
                  // if (args[0] == 'r') {
                  //     message.member.roles.remove(role.id);
                  //     message.react('✅');

                  // var rolex = message.guild.roles.fetch("821592780404817931").then(res => console.log(res.id));
                  // console.log("result", user, rolex);
                  // user.roles.addRole(rolex);
                  return message.channel.send(
                    `등록되었습니다.\n\`\`\` 이름:${username} MBTI:${mbti}\`\`\``
                  );
                } else {
                  const { userId, userName, birthday, mbti } = res;
                  return message.channel.send(
                    `이미 등록된 유저입니다\n\`\`\` 이름:${userName} MBTI:${mbti}\`\`\``
                  );
                }
              })
              .catch((err) => console.log(err));
          });
        } else {
          return message.channel.send(
            "MBTI가 제대로 입력되지 않았습니다. (Ex. ISFP ENTP) 2"
          );
        }
      } else {
        return message.channel.send(
          "당신은 이 명령어를 사용할 권한이 없습니다. (NOT AN ADMIN)"
        );
      }
    }
  },
};
