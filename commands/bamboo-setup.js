const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const BambooConfig = require("../models/bamboo-config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("대나무숲설정")
    .setDescription("/대나무숲 제출 내용이 도착할 운영진 전용 채널을 지정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName("채널")
        .setDescription("제출 내용을 받을 채널 (일반 멤버는 볼 수 없는 채널이어야 합니다)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("채널");

    await BambooConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { guildId: interaction.guild.id, alertChannelId: channel.id },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return interaction.reply({
      content: `설정 완료! 이제 \`/대나무숲\` 제출 내용은 ${channel} 채널로 전달됩니다. 이 채널에 일반 멤버가 접근할 수 없는지 서버 권한 설정을 꼭 확인해주세요.`,
      ephemeral: true,
    });
  },
};
