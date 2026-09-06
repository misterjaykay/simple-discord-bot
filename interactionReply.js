// Shared helpers for commands that must defer immediately (before doing any
// DB work) but don't yet know at defer time whether their eventual result
// should be ephemeral or public. Deferring ephemerally acks within Discord's
// 3s window regardless of how slow the DB round-trips end up being; these
// then route the actual result correctly whether or not the command ended up
// deferring first.
//
// Background: commands used to do their DB work first and call
// interaction.reply() only at the end. If that DB work took long enough to
// blow past Discord's 3s ack window (a slow/cold Mongo connection), reply()
// throws "Unknown interaction" - which looked like the command failed, even
// though its DB writes (points deducted, daily counters incremented, etc.)
// had already been saved. Retrying then silently double-applied those
// writes. See commands/points/lottery.js for the original fix.

// Use for a reply that should stay private to the invoking user.
async function replyEphemeral(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply({ ...payload, ephemeral: true });
}

// Use for a reply that should be visible in the channel. If the command
// already deferred ephemerally (the placeholder "thinking..." was private),
// editReply can't change a defer's ephemeral flag, so the real result has to
// go out some other way. Posting it as a followUp while deleting that
// placeholder broke Discord's client-side rendering of the followUp
// ("Message could not be loaded", seen in production); editing the
// placeholder to a trivial confirmation instead of deleting it fixed that
// but left an ugly, pointless second message next to the real result. Ordinary
// channel.send() sidesteps both: it's a plain message with no relationship
// to the interaction's response chain at all, so the ephemeral placeholder
// can just be deleted cleanly with nothing left over.
async function replyPublic(interaction, payload) {
  if (interaction.deferred && !interaction.replied) {
    await interaction.deleteReply().catch(() => {});
    return interaction.channel.send(payload);
  }
  if (interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: false });
  }
  return interaction.reply(payload);
}

// For a command whose successful outcome is the common case and should carry
// Discord's native "[user] used /command" attribution: defer non-ephemeral
// (interaction.deferReply({ ephemeral: false })), then use plain
// interaction.editReply() for the success case - a single message with the
// real attribution header, not a plain @mention worked around into the
// content. A failure/error can't reuse that already-public response (Discord
// won't let a defer's ephemeral flag change), so route it through this
// instead: deletes the public "thinking..." placeholder and sends the error
// as a fresh ephemeral followUp, keeping the channel clean of a stuck
// "thinking" message. Unlike replyPublic's delete+followUp (which broke
// Discord's client-side rendering going ephemeral-defer -> public-followUp),
// this is the reverse direction (public-defer -> ephemeral-followUp) and
// hasn't been confirmed safe from the same "message could not be loaded"
// quirk - if it turns out to have the same problem, it'll only be visible
// to the one user who hit the error, not the whole channel.
async function replyPrivateError(interaction, payload) {
  if (interaction.deferred && !interaction.replied) {
    await interaction.deleteReply().catch(() => {});
    return interaction.followUp({ ...payload, ephemeral: true });
  }
  if (interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: true });
  }
  return interaction.reply({ ...payload, ephemeral: true });
}

module.exports = { replyEphemeral, replyPublic, replyPrivateError };
