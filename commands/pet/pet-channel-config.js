const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const GuildPointsConfig = require("../../models/guild-points-config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫채널설정")
    .setDescription("펫 관련 명령어를 사용할 수 있는 채널을 지정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("지정")
        .setDescription("펫 명령어를 이 채널에서만 사용할 수 있게 제한합니다.")
        .addChannelOption((opt) =>
          opt.setName("채널").setDescription("펫 명령어를 허용할 채널").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("해제").setDescription("채널 제한을 해제합니다 (모든 채널에서 사용 가능)"))
    .addSubcommand((sub) => sub.setName("확인").setDescription("현재 채널 제한 설정을 확인합니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "지정") {
      const channel = interaction.options.getChannel("채널");
      await GuildPointsConfig.findOneAndUpdate({ guildId }, { petChannelId: channel.id }, { upsert: true });
      return interaction.reply(
        `앞으로 펫 관련 명령어(입양/정보/밥주기/놀아주기/이름변경/파양/대전)는 ${channel}에서만 사용할 수 있어요.`
      );
    }

    if (sub === "해제") {
      await GuildPointsConfig.findOneAndUpdate({ guildId }, { petChannelId: null }, { upsert: true });
      return interaction.reply("채널 제한을 해제했어요. 이제 모든 채널에서 펫 명령어를 사용할 수 있습니다.");
    }

    if (sub === "확인") {
      const config = await GuildPointsConfig.findOne({ guildId });
      const content = config?.petChannelId
        ? `현재 펫 명령어는 <#${config.petChannelId}>에서만 사용할 수 있어요.`
        : "현재 채널 제한이 없어요. 모든 채널에서 펫 명령어를 사용할 수 있습니다.";
      return interaction.reply({ content, ephemeral: true });
    }
  },
};
