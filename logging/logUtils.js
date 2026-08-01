function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// "X years, Y months and Z days ago" style duration, matching Carl-bot's format.
function formatDurationSince(date) {
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  let days = now.getDate() - date.getDate();

  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (parts.length === 0) return "today";
  if (parts.length === 1) return `${parts[0]} ago`;

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} ago`;
}

// Turns a PascalCase discord.js permission flag name (e.g. "SendMessages") into
// "Send messages" style text, matching Carl-bot's overwrite log format.
function humanizePermission(flag) {
  const spaced = flag.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function overwriteTargetLabel(channel, overwrite) {
  if (overwrite.type === 0) {
    if (overwrite.id === channel.guild.id) return "@everyone";
    const role = channel.guild.roles.cache.get(overwrite.id);
    return role ? `@${role.name}` : `<@&${overwrite.id}>`;
  }
  const member = channel.guild.members.cache.get(overwrite.id);
  return member ? `@${member.user.username}` : `<@${overwrite.id}>`;
}

// Builds one embed field per role/member that has an explicit permission
// overwrite on the channel, listing only the perms actually allowed/denied.
function formatPermissionOverwriteFields(channel) {
  const fields = [];
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    const lines = [
      ...overwrite.allow.toArray().map((p) => `${humanizePermission(p)}: ✅`),
      ...overwrite.deny.toArray().map((p) => `${humanizePermission(p)}: ❌`),
    ];
    if (lines.length === 0) continue;

    fields.push({ name: `Role override for ${overwriteTargetLabel(channel, overwrite)}`, value: lines.join("\n") });
  }
  return fields;
}

module.exports = { ordinal, formatDurationSince, humanizePermission, formatPermissionOverwriteFields };
