const { SlashCommandBuilder } = require("discord.js");
const { checkIn } = require("../../points/checkinService");
const { sendMissionFollowUp } = require("../../points/missionService");
const { replyPrivateError } = require("../../interactionReply");

module.exports = {
  data: new SlashCommandBuilder().setName("출석").setDescription("하루 한 번 출석체크를 하고 포인트를 받습니다."),
  async execute(interaction) {
    // Deferred immediately (before any DB work) - checkIn() chains several
    // sequential DB round-trips (balance lookup, save, mission bookkeeping),
    // which can blow past Discord's 3s ack window on a slow connection. See
    // interactionReply.js for why this matters. Deferred *non-ephemeral*
    // (unlike most other commands here) so the common-case success reply
    // below can use plain editReply() and keep Discord's native "[user] used
    // /출석" attribution, instead of losing it the way a public followUp/
    // channel.send would.
    await interaction.deferReply({ ephemeral: false });

    const result = await checkIn(interaction.guild.id, interaction.user);

    if (result.alreadyCheckedIn) {
      return replyPrivateError(interaction, { content: "오늘은 이미 출석체크를 했어요. 내일 다시 와주세요!" });
    }

    await interaction.editReply({
      content: `✅ 출석체크 완료! **${result.awarded}** 포인트를 받았어요. (연속 출석 **${result.streak}**일째)`,
    });
    await sendMissionFollowUp(interaction, result.missionResult);
  },
};
