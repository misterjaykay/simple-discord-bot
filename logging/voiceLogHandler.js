const { EmbedBuilder } = require("discord.js");
const { sendLog } = require("./logConfigService");

async function logVoiceStateChange(oldState, newState) {
  const guild = newState.guild ?? oldState.guild;
  const member = newState.member ?? oldState.member;
  if (!member) return;

  // Moving between two channels changes both oldState.channelId and
  // newState.channelId in one event - log it as one leave + one join, same as
  // a normal disconnect/connect.
  if (oldState.channelId === newState.channelId) return;

  if (oldState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
      .setTitle("Member left voice channel")
      .setDescription(`**${member.displayName}** left <#${oldState.channelId}>`)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();
    await sendLog(guild, "voice", { embeds: [embed] });
  }

  if (newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
      .setTitle("Member joined voice channel")
      .setDescription(`**${member.displayName}** joined <#${newState.channelId}>`)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();
    await sendLog(guild, "voice", { embeds: [embed] });
  }
}

module.exports = { logVoiceStateChange };
