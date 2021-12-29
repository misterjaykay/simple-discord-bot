module.exports = {
  name: "스톱",
  description: "음악재생 멈추기",
  async execute(message, args) {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) return message.channel.send("채널에 있지 않습니다.");
    await voiceChannel.leave();
    await message.channel.send("음악을 멈추고 채널에서 나갑니다. :D");
  },
};
