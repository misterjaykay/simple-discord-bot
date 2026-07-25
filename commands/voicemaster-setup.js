const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const VoiceMasterConfig = require("../models/voicemaster-config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("보이스마스터-설정")
    .setDescription("입장하면 개인 음성 채널이 자동 생성되는 시스템을 설정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("생성").setDescription("새로운 '채널 생성' 트리거 채널과 카테고리를 자동으로 만듭니다."))
    .addSubcommand((sub) =>
      sub
        .setName("채널지정")
        .setDescription("이미 있는 음성 채널을 '채널 생성' 트리거로 지정합니다.")
        .addChannelOption((opt) =>
          opt.setName("채널").setDescription("트리거로 사용할 음성 채널").addChannelTypes(ChannelType.GuildVoice).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("해제").setDescription("보이스마스터 기능을 비활성화합니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "해제") {
      await VoiceMasterConfig.deleteOne({ guildId: interaction.guild.id });
      return interaction.reply({ content: "보이스마스터 기능을 비활성화했습니다.", ephemeral: true });
    }

    if (sub === "채널지정") {
      const channel = interaction.options.getChannel("채널");
      await VoiceMasterConfig.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, triggerChannelId: channel.id, categoryId: channel.parentId },
        { upsert: true }
      );
      return interaction.reply({
        content: `${channel} 채널에 입장하면 개인 음성 채널이 자동으로 생성되도록 설정했습니다.`,
        ephemeral: true,
      });
    }

    // 생성 (기본값): 새 카테고리 + 트리거 채널을 만들어서 바로 세팅
    await interaction.deferReply({ ephemeral: true });
    const category = await interaction.guild.channels.create({
      name: "음성 채널",
      type: ChannelType.GuildCategory,
    });
    const trigger = await interaction.guild.channels.create({
      name: "➕ 채널 생성",
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
    await VoiceMasterConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { guildId: interaction.guild.id, triggerChannelId: trigger.id, categoryId: category.id },
      { upsert: true }
    );
    return interaction.editReply(`설정 완료! ${trigger} 채널에 입장하면 자동으로 개인 음성 채널이 생성됩니다.`);
  },
};
