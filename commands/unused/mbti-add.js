const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

const VALID_MBTI = ["ISFJ", "ESFJ", "INFJ", "ENFJ", "ISTJ", "ESTJ", "INTJ", "ENTJ", "INFP", "ENFP", "INTP", "ENTP", "ISFP", "ESFP", "ISTP", "ESTP"];

module.exports = {
  hidden: true, // 현재 사용되지 않아 숨김 처리 (2026-07-30)
  data: new SlashCommandBuilder()
    .setName("mbti")
    .setDescription("MBTI를 등록하고 해당 역할을 부여받습니다.")
    .addStringOption((opt) =>
      opt
        .setName("유형")
        .setDescription("본인의 MBTI")
        .setRequired(true)
        .addChoices(...VALID_MBTI.map((m) => ({ name: m, value: m })))
    ),
  async execute(interaction) {
    const mbti = interaction.options.getString("유형").toUpperCase();
    const user = interaction.user;

    try {
      const existing = await db.Birthday.findOne({ userId: user.id });
      if (existing && existing.mbti) {
        return interaction.reply({
          content: `이미 등록된 유저입니다.\n\`\`\`이름:${existing.userName} MBTI:${existing.mbti}\`\`\``,
          ephemeral: true,
        });
      }

      if (existing) {
        existing.mbti = mbti;
        await existing.save();
      } else {
        await new db.Birthday({ userId: user.id, userName: user.username, mbti }).save();
      }

      const role = interaction.guild.roles.cache.find((r) => r.name === mbti);
      if (role) {
        await interaction.member.roles.add(role).catch((err) => console.error("Failed to add MBTI role:", err));
      }

      return interaction.reply(`등록되었습니다.\n\`\`\`이름:${user.username} MBTI:${mbti}\`\`\``);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "MBTI를 등록하는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
