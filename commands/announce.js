const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js");

// Takes raw Discord embed JSON (either { embeds: [...] } or a single embed
// object) so admins can paste whatever an embed generator/LLM hands them
// without this command needing its own title/description/color/field
// options - see commands/unused/schedule.js for the older plain-text-only
// version this supersedes (kept there, deprecated, for history).
module.exports = {
  data: new SlashCommandBuilder()
    .setName("공지")
    .setDescription("지정한 채널에 임베드 공지를 보냅니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName("채널").setDescription("공지를 보낼 채널").addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("json").setDescription('임베드 JSON (예: {"embeds":[{"title":"...", ...}]})').setRequired(true)
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel("채널");
    const raw = interaction.options.getString("json");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return interaction.reply({ content: `JSON을 해석하지 못했어요: ${err.message}`, ephemeral: true });
    }

    const rawEmbeds = Array.isArray(parsed.embeds) ? parsed.embeds : [parsed];

    let embeds;
    try {
      embeds = rawEmbeds.map((e) => EmbedBuilder.from(e));
    } catch (err) {
      return interaction.reply({ content: `임베드 형식이 올바르지 않아요: ${err.message}`, ephemeral: true });
    }

    try {
      await channel.send({ content: typeof parsed.content === "string" ? parsed.content : undefined, embeds });
    } catch (err) {
      return interaction.reply({ content: `전송에 실패했어요: ${err.message}`, ephemeral: true });
    }

    return interaction.reply({ content: `${channel}에 공지를 보냈어요.`, ephemeral: true });
  },
};
