const { SlashCommandBuilder } = require("discord.js");
const { startSession, ENTRY_FEE, DAILY_SESSION_LIMIT, MAX_STREAK } = require("../../rps/rpsService");
const { buildHandChoiceMessage } = require("../../rps/rpsView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("가위바위보")
    .setDescription(
      `참가비 ${ENTRY_FEE}포인트를 걸고 연승에 도전합니다 (최대 ${MAX_STREAK}연승, 지면 전부 날아가요). 하루 ${DAILY_SESSION_LIMIT}번.`
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;

    let started;
    try {
      started = await startSession(guildId, interaction.user);
    } catch (err) {
      return interaction.reply({ content: err.message, ephemeral: true });
    }

    return interaction.reply({ ...buildHandChoiceMessage(started.sessionId, 0, 0), ephemeral: true });
  },
};
