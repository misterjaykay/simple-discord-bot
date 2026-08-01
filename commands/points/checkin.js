const { SlashCommandBuilder } = require("discord.js");
const { checkIn } = require("../../points/checkinService");

module.exports = {
  data: new SlashCommandBuilder().setName("출석").setDescription("하루 한 번 출석체크를 하고 포인트를 받습니다."),
  async execute(interaction) {
    const result = await checkIn(interaction.guild.id, interaction.user);

    if (result.alreadyCheckedIn) {
      return interaction.reply({ content: "오늘은 이미 출석체크를 했어요. 내일 다시 와주세요!", ephemeral: true });
    }

    return interaction.reply(`✅ 출석체크 완료! **${result.awarded}** 포인트를 받았어요. (연속 출석 **${result.streak}**일째)`);
  },
};
