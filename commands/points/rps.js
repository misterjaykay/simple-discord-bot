const { SlashCommandBuilder } = require("discord.js");
const { startSession, ENTRY_FEE, DAILY_SESSION_LIMIT, MAX_STREAK } = require("../../rps/rpsService");
const { buildHandChoiceMessage } = require("../../rps/rpsView");
const { replyEphemeral } = require("../../interactionReply");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("가위바위보")
    .setDescription(
      `참가비 ${ENTRY_FEE}포인트를 걸고 연승에 도전합니다 (최대 ${MAX_STREAK}연승, 지면 전부 날아가요). 하루 ${DAILY_SESSION_LIMIT}번.`
    ),
  async execute(interaction) {
    // Deferred immediately (before any DB work) - startSession chains several
    // sequential DB round-trips (entry fee deduction, session save, jackpot
    // feed), which can blow past Discord's 3s ack window on a slow
    // connection. See interactionReply.js for why this matters.
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;

    let started;
    try {
      started = await startSession(guildId, interaction.user);
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }

    return replyEphemeral(interaction, buildHandChoiceMessage(started.sessionId, 0, 0));
  },
};
