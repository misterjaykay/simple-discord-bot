const { SlashCommandBuilder } = require("discord.js");
const { checkIn } = require("../../points/checkinService");
const { sendMissionFollowUp } = require("../../points/missionService");
const { replyEphemeral, replyPublic } = require("../../interactionReply");

module.exports = {
  data: new SlashCommandBuilder().setName("출석").setDescription("하루 한 번 출석체크를 하고 포인트를 받습니다."),
  async execute(interaction) {
    // Deferred immediately (before any DB work) - checkIn() chains several
    // sequential DB round-trips (balance lookup, save, mission bookkeeping),
    // which can blow past Discord's 3s ack window on a slow connection. See
    // interactionReply.js for why this matters.
    await interaction.deferReply({ ephemeral: true });

    const result = await checkIn(interaction.guild.id, interaction.user);

    if (result.alreadyCheckedIn) {
      return replyEphemeral(interaction, { content: "오늘은 이미 출석체크를 했어요. 내일 다시 와주세요!" });
    }

    await replyPublic(interaction, {
      content: `✅ 출석체크 완료! **${result.awarded}** 포인트를 받았어요. (연속 출석 **${result.streak}**일째)`,
    });
    await sendMissionFollowUp(interaction, result.missionResult);
  },
};
