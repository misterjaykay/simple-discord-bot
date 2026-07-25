const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("공지")
    .setDescription("지정한 채널에 공지를 보냅니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) => opt.setName("채널").setDescription("공지를 보낼 채널").addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption((opt) => opt.setName("내용").setDescription("공지 내용").setRequired(true)),
  async execute(interaction) {
    const channel = interaction.options.getChannel("채널");
    const content = interaction.options.getString("내용");
    await channel.send(content);
    return interaction.reply({ content: `${channel}에 공지를 보냈습니다.`, ephemeral: true });
  },
};
