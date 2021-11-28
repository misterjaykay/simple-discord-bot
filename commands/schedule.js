module.exports = {
  name: "방송시작",
  expectedArgs: '<Channel tag>',
  cooldown: 5,
//   guildOnly: true,
  requiredPermission: ["ADMINISTRATOR"],
  execute(message, args, client) {
      const { mentions, guild, channel } = message;
    message.channel.send("Hello");
    // console.log(message.channel);

    const targetChannel = mentions.channels.first();
    console.log(targetChannel)

    console.log(channel);

    message.targetChannel.send("Hello Too")

  },
};
