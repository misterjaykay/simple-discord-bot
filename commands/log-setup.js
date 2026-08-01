const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const LogConfig = require("../models/log-config");
const { LOG_TYPES, refreshMessageLogGuildCache } = require("../logging/logConfigService");

const TYPE_CHOICES = [
  { name: "음성 입장/퇴장", value: "voice" },
  { name: "메시지 수정/삭제", value: "message" },
  { name: "입장/퇴장", value: "joinLeave" },
  { name: "서버(채널 생성/삭제)", value: "server" },
];
const TYPE_LABELS = Object.fromEntries(TYPE_CHOICES.map((c) => [c.value, c.name]));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("로그설정")
    .setDescription("각 종류별 로그를 보낼 채널을 설정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("지정")
        .setDescription("로그 종류에 채널을 지정합니다.")
        .addStringOption((opt) => opt.setName("종류").setDescription("로그 종류").setRequired(true).addChoices(...TYPE_CHOICES))
        .addChannelOption((opt) =>
          opt.setName("채널").setDescription("로그를 보낼 텍스트 채널").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("목록").setDescription("현재 설정된 로그 채널 목록을 봅니다."))
    .addSubcommand((sub) =>
      sub
        .setName("해제")
        .setDescription("로그 종류를 하나 또는 전부 해제합니다.")
        .addStringOption((opt) => opt.setName("종류").setDescription("해제할 로그 종류 (비워두면 전부 해제)").setRequired(false).addChoices(...TYPE_CHOICES))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "목록") {
      const config = await LogConfig.findOne({ guildId });
      if (!config) {
        return interaction.reply({ content: "설정된 로그 채널이 없습니다. `/로그설정 지정`으로 만들어보세요.", ephemeral: true });
      }
      const lines = TYPE_CHOICES.map(({ value, name }) => {
        const channelId = config[LOG_TYPES[value]];
        return `${name}: ${channelId ? `<#${channelId}>` : "미설정"}`;
      });
      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }

    if (sub === "해제") {
      const type = interaction.options.getString("종류");
      if (type) {
        await LogConfig.findOneAndUpdate({ guildId }, { $unset: { [LOG_TYPES[type]]: 1 } });
        await refreshMessageLogGuildCache();
        return interaction.reply({ content: `${TYPE_LABELS[type]} 로그를 해제했습니다.`, ephemeral: true });
      }
      await LogConfig.deleteOne({ guildId });
      await refreshMessageLogGuildCache();
      return interaction.reply({ content: "이 서버의 로그 설정을 전부 해제했습니다.", ephemeral: true });
    }

    // 지정
    const type = interaction.options.getString("종류");
    const channel = interaction.options.getChannel("채널");

    await LogConfig.findOneAndUpdate({ guildId }, { guildId, [LOG_TYPES[type]]: channel.id }, { upsert: true, setDefaultsOnInsert: true });
    await refreshMessageLogGuildCache();

    return interaction.reply({ content: `${TYPE_LABELS[type]} 로그를 ${channel}로 지정했습니다.`, ephemeral: true });
  },
};
