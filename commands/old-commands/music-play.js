const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");

module.exports = {
  name: "재생",
  description: "음악 재생",
  async execute(message, args) {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) return message.channel.send("채널에 있지 않습니다.");
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT"))
      return message.channel.send("권한이 없습니다.");
    if (!permissions.has("SPEAK"))
      return message.channel.send("권한이 없습니다.");

    if (!args.length) return message.channel.send("Argument Needed");

    const validURL = (str) => {
        var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
        if (!regex.test(str)) {
            return false;
        } else {
            return true;
        }
    }

    if(validURL(args[0])) {
        message.channel.send('You entered a correct url!');

        const connection = await voiceChannel.join();
        const stream = ytdl(args[0], { filter: 'audioonly'});

        connection.play(stream, {seek: 0, volume: 1})
        .on('finish', () => {
            voiceChannel.leave();
            message.channel.send('leaving channel');
        });

        await message.reply('Now Playing ***Your Link***');

        return
    }

    const connection = await voiceChannel.join();

    const videoFinder = async (query) => {
      const videoResult = await ytSearch(query);

      return videoResult.videos.length > 1 ? videoResult.videos[0] : null;
    };

    const video = await videoFinder(args.join(" "));

    if (video) {
      const stream = ytdl(video.url, { finder: "audioonly" });
      connection.play(stream, { seek: 0, volume: 1 }).on("finish", () => {
        voiceChannel.leave();
      });

      await message.reply(`Now Playing ***${video.title}***`);
    } else {
      message.channel.send("No Video results found");
    }
  },
};
