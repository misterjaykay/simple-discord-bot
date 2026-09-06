// Shared helpers for commands that must defer immediately (before doing any
// DB work) - a slow DB round-trip before ANY acknowledgment used to make
// interaction.reply() arrive too late (Discord's 3s ack window), which threw
// "Unknown interaction" even though the DB write (points deducted, a daily
// counter bumped, etc.) had already gone through. Retrying then silently
// double-applied those writes. See commands/points/lottery.js for the
// original fix.
//
// Deferring commits to an ephemeral/public flag immediately, before the
// command's real outcome is known - these two helpers route the eventual
// reply correctly either way, by checking interaction.ephemeral (set by
// discord.js on deferReply()/reply() - true iff MessageFlags.Ephemeral was
// used) rather than assuming which way the caller deferred:
//   - deferred the way that already matches (ephemeral defer + ephemeral
//     reply, or public defer + public reply): a plain editReply() -
//     single message, and if public, Discord's native
//     "[user] used /command" attribution renders correctly since it's the
//     interaction's real primary response.
//   - deferred the OTHER way: editReply can't flip an already-committed
//     ephemeral flag, so the placeholder is deleted and the real reply goes
//     out as a followUp with the flag it actually needs instead.
// A public followUp after deleting an ephemeral placeholder broke Discord's
// client-side rendering in production ("Message could not be loaded"); an
// ephemeral followUp after deleting a public placeholder is the untested
// reverse direction - if it turns out to have the same issue, at least only
// the one user hitting that path would see it, not the whole channel.

// Use for a reply that should stay private to the invoking user.
async function replyEphemeral(interaction, payload) {
  if (interaction.deferred && !interaction.replied) {
    if (interaction.ephemeral) return interaction.editReply(payload);
    await interaction.deleteReply().catch(() => {});
    return interaction.followUp({ ...payload, ephemeral: true });
  }
  if (interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: true });
  }
  return interaction.reply({ ...payload, ephemeral: true });
}

// Use for a reply that should be visible in the channel.
async function replyPublic(interaction, payload) {
  if (interaction.deferred && !interaction.replied) {
    if (!interaction.ephemeral) return interaction.editReply(payload);
    await interaction.deleteReply().catch(() => {});
    return interaction.channel.send(payload);
  }
  if (interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: false });
  }
  return interaction.reply(payload);
}

module.exports = { replyEphemeral, replyPublic };
