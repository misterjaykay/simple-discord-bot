const { SlashCommandBuilder } = require("discord.js");
const TempVoiceChannel = require("../models/temp-voice-channel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("보이스채널")
    .setDescription("보이스마스터로 만든 내 채널을 관리합니다.")
    .addSubcommand((sub) =>
      sub.setName("이름").setDescription("채널 이름을 변경합니다.").addStringOption((opt) => opt.setName("이름").setDescription("새 채널 이름").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("인원제한")
        .setDescription("채널 인원 제한을 변경합니다.")
        .addIntegerOption((opt) => opt.setName("인원").setDescription("0은 무제한").setMinValue(0).setMaxValue(99).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("잠금").setDescription("채널을 잠급니다."))
    .addSubcommand((sub) => sub.setName("잠금해제").setDescription("채널 잠금을 해제합니다."))
    .addSubcommand((sub) => sub.setName("소유권가져오기").setDescription("방장이 자리를 비운 채널의 소유권을 가져옵니다.")),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: "먼저 음성 채널에 입장해주세요.", ephemeral: true });
    }

    const tracked = await TempVoiceChannel.findOne({ channelId: voiceChannel.id });
    if (!tracked) {
      return interaction.reply({ content: "보이스마스터로 생성된 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "소유권가져오기") {
      if (voiceChannel.members.has(tracked.ownerId)) {
        return interaction.reply({ content: "현재 방장이 채널에 있어서 소유권을 가져올 수 없습니다.", ephemeral: true });
      }
      tracked.ownerId = interaction.user.id;
      await tracked.save();
      return interaction.reply(`<@${interaction.user.id}> 님이 새로운 방장이 되었습니다. 👑`);
    }

    if (interaction.user.id !== tracked.ownerId) {
      return interaction.reply({ content: "채널 방장만 사용할 수 있어요.", ephemeral: true });
    }

    if (sub === "이름") {
      const name = interaction.options.getString("이름").slice(0, 90);
      await voiceChannel.setName(name);
      return interaction.reply({ content: `채널 이름을 "${name}"(으)로 변경했습니다.`, ephemeral: true });
    }

    if (sub === "인원제한") {
      const limit = interaction.options.getInteger("인원");
      await voiceChannel.setUserLimit(limit);
      return interaction.reply({ content: `인원 제한을 ${limit === 0 ? "무제한" : `${limit}명`}(으)로 변경했습니다.`, ephemeral: true });
    }

    if (sub === "잠금" || sub === "잠금해제") {
      const everyone = interaction.guild.roles.everyone;
      await voiceChannel.permissionOverwrites.edit(everyone, { Connect: sub === "잠금해제" ? null : false });
      return interaction.reply({ content: sub === "잠금" ? "채널을 잠갔습니다. 🔒" : "채널을 열었습니다. 🔓", ephemeral: true });
    }
  },
};
