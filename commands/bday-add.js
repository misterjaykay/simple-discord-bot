const { SlashCommandBuilder } = require("discord.js");
const db = require("../models");
const { replyEphemeral, replyPublic } = require("../interactionReply");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("생일추가")
    .setDescription("내 생일을 등록합니다.")
    .addIntegerOption((opt) => opt.setName("월").setDescription("태어난 월").setMinValue(1).setMaxValue(12).setRequired(true))
    .addIntegerOption((opt) => opt.setName("일").setDescription("태어난 일").setMinValue(1).setMaxValue(31).setRequired(true)),
  async execute(interaction) {
    // Deferred immediately (before any DB work) - a lookup plus a save is two
    // sequential DB round-trips before the reply, which can blow past
    // Discord's 3s ack window on a slow connection. See interactionReply.js.
    await interaction.deferReply({ ephemeral: true });

    const month = interaction.options.getInteger("월");
    const day = interaction.options.getInteger("일");
    const { id, username } = interaction.user;

    try {
      const existing = await db.Birthday.findOne({ userId: id });
      if (existing && existing.birthday) {
        const existingMonth = existing.birthday.getMonth() + 1;
        const existingDay = existing.birthday.getDate();
        return replyEphemeral(interaction, {
          content: `이미 등록된 유저입니다.\n\`\`\`이름:${existing.userName} 생일:${existingMonth}월 ${existingDay}일\`\`\``,
        });
      }

      const birthday = new Date(Date.UTC(2000, month - 1, day));

      if (existing) {
        existing.birthday = birthday;
        await existing.save();
      } else {
        await new db.Birthday({ userId: id, userName: username, birthday }).save();
      }

      return replyPublic(interaction, { content: `등록되었습니다.\n\`\`\`이름:${username} 생일:${month}월 ${day}일\`\`\`` });
    } catch (err) {
      console.error(err);
      return replyEphemeral(interaction, { content: "생일을 등록하는 중 오류가 발생했습니다." });
    }
  },
};
