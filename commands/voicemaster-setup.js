const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const VoiceMasterConfig = require("../models/voicemaster-config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("보이스설정")
    .setDescription("입장하면 개인 음성 채널이 자동 생성되는 시스템을 설정합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("생성")
        .setDescription("새로운 '채널 생성' 트리거 채널과 카테고리를 자동으로 만듭니다. (여러 개 만들 수 있어요) (관리자 전용)")
        .addStringOption((opt) => opt.setName("이름형식").setDescription("생성될 채널 이름 형식. {user}는 방장 이름으로 대체됩니다. 기본값: {user}의 채널").setRequired(false))
        .addRoleOption((opt) => opt.setName("방장역할").setDescription("채널 방장에게 자동으로 부여/회수할 역할").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("채널지정")
        .setDescription("이미 있는 음성 채널을 '채널 생성' 트리거로 지정합니다. (기존 트리거면 설정을 갱신합니다) (관리자 전용)")
        .addChannelOption((opt) => opt.setName("채널").setDescription("트리거로 사용할 음성 채널").addChannelTypes(ChannelType.GuildVoice).setRequired(true))
        .addStringOption((opt) => opt.setName("이름형식").setDescription("생성될 채널 이름 형식. {user}는 방장 이름으로 대체됩니다.").setRequired(false))
        .addRoleOption((opt) => opt.setName("방장역할").setDescription("채널 방장에게 자동으로 부여/회수할 역할").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("목록").setDescription("현재 설정된 트리거 채널 목록을 봅니다. (관리자 전용)"))
    .addSubcommand((sub) =>
      sub
        .setName("해제")
        .setDescription("트리거를 하나 또는 전부 비활성화합니다. (관리자 전용)")
        .addChannelOption((opt) => opt.setName("채널").setDescription("비활성화할 트리거 채널 (비워두면 이 서버의 트리거를 전부 해제)").addChannelTypes(ChannelType.GuildVoice).setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "목록") {
      const configs = await VoiceMasterConfig.find({ guildId: interaction.guild.id });
      if (configs.length === 0) {
        return interaction.reply({ content: "설정된 트리거 채널이 없습니다. `/보이스설정 생성`으로 만들어보세요.", ephemeral: true });
      }
      const list = configs
        .map((c) => `<#${c.triggerChannelId}> - 이름형식: \`${c.nameTemplate}\`${c.ownerRoleId ? ` / 방장역할: <@&${c.ownerRoleId}>` : ""}`)
        .join("\n");
      return interaction.reply({ content: `현재 트리거 채널 목록:\n${list}`, ephemeral: true });
    }

    if (sub === "해제") {
      const channel = interaction.options.getChannel("채널");
      if (channel) {
        await VoiceMasterConfig.deleteOne({ triggerChannelId: channel.id });
        return interaction.reply({ content: `${channel} 트리거를 비활성화했습니다.`, ephemeral: true });
      }
      await VoiceMasterConfig.deleteMany({ guildId: interaction.guild.id });
      return interaction.reply({ content: "이 서버의 트리거 채널을 전부 비활성화했습니다.", ephemeral: true });
    }

    if (sub === "채널지정") {
      const channel = interaction.options.getChannel("채널");
      const nameTemplate = interaction.options.getString("이름형식");
      const role = interaction.options.getRole("방장역할");

      const update = {
        guildId: interaction.guild.id,
        triggerChannelId: channel.id,
        categoryId: channel.parentId,
      };
      if (nameTemplate) update.nameTemplate = nameTemplate;
      if (role) update.ownerRoleId = role.id;

      await VoiceMasterConfig.findOneAndUpdate({ triggerChannelId: channel.id }, update, { upsert: true, setDefaultsOnInsert: true });
      return interaction.reply({
        content: `${channel} 채널에 입장하면 개인 음성 채널이 자동으로 생성되도록 설정했습니다.`,
        ephemeral: true,
      });
    }

    // 생성 (기본값): 새 카테고리 + 트리거 채널을 만들어서 바로 세팅. 이미 트리거가 있어도 상관없이
    // 새로 하나 더 만들 수 있습니다 (트리거 채널 개수 제한 없음).
    const nameTemplate = interaction.options.getString("이름형식");
    const role = interaction.options.getRole("방장역할");

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

    await new VoiceMasterConfig({
      guildId: interaction.guild.id,
      triggerChannelId: trigger.id,
      categoryId: category.id,
      ...(nameTemplate ? { nameTemplate } : {}),
      ...(role ? { ownerRoleId: role.id } : {}),
    }).save();

    return interaction.editReply(`설정 완료! ${trigger} 채널에 입장하면 자동으로 개인 음성 채널이 생성됩니다.`);
  },
};
