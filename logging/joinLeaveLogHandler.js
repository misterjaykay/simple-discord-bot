const { EmbedBuilder } = require("discord.js");
const { sendLog } = require("./logConfigService");
const { ordinal, formatDurationSince } = require("./logUtils");

async function logMemberAdd(member) {
  const guild = member.guild;

  // Rank among currently-present members sorted by join time, matching the
  // "93rd to join" wording from Carl-bot. Relies on the member cache being
  // warmed with guild.members.fetch() on startup (see index.js).
  const membersByJoin = [...guild.members.cache.values()]
    .filter((m) => m.joinedTimestamp)
    .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
  const rank = membersByJoin.findIndex((m) => m.id === member.id) + 1;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
    .setTitle("Member joined")
    .setDescription(`<@${member.id}> ${rank > 0 ? `${ordinal(rank)} to join` : ""}\ncreated ${formatDurationSince(member.user.createdAt)}`)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendLog(guild, "joinLeave", { embeds: [embed] });
}

async function logMemberRemove(member) {
  const guild = member.guild;
  const roles = member.roles?.cache?.filter((r) => r.id !== guild.id);
  const roleText = roles && roles.size > 0 ? [...roles.values()].map((r) => `<@&${r.id}>`).join(" ") : "없음";
  const joinedText = member.joinedAt ? `joined ${formatDurationSince(member.joinedAt)}` : "가입 기록 없음";

  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
    .setTitle("Member left")
    .setDescription(`<@${member.id}> ${joinedText}\n**Roles:** ${roleText}`)
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendLog(guild, "joinLeave", { embeds: [embed] });
}

module.exports = { logMemberAdd, logMemberRemove };
