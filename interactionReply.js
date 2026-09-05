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
// editReply can't change a defer's ephemeral flag, so the real result is
// posted as a public followUp instead - but the ephemeral placeholder is
// edited to something trivial rather than deleted. Deleting it (an earlier
// version of this helper did) broke Discord's client-side rendering of the
// followUp: with the original deferred response gone, the client couldn't
// resolve it and showed "Message could not be loaded" on the followUp in
// production (seen on 펫밥주기/펫놀아주기 전체 results and elsewhere).
async function replyPublic(interaction, payload) {
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ content: "✅ 완료 (아래 메시지 확인)" }).catch(() => {});
    return interaction.followUp({ ...payload, ephemeral: false });
  }
  if (interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: false });
  }
  return interaction.reply(payload);
}

module.exports = { replyEphemeral, replyPublic };
