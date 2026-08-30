const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { dispatchPayout } = require("./petService");

// userId + slot + days are embedded in the customId (no session store needed,
// same reasoning as releaseView) so the component handler can reject anyone
// but the person who ran /펫파견 and knows exactly what was being confirmed.
function buildDispatchConfirmMessage(pet, userId, days) {
  const payout = dispatchPayout(days);
  const embed = new EmbedBuilder()
    .setTitle(`${pet.nickname ?? pet.speciesName}(${pet.slot}번 슬롯)를(을) ${days}일간 파견 보낼까요?`)
    .setImage(pet.spriteUrl)
    .setDescription(
      `⚠️ 한 번 시작하면 **중간에 되돌릴 수 없어요.**\n` +
        `파견 중엔 이 펫에게 밥주기/놀아주기/진화/파양을 할 수 없어요.\n\n` +
        `확정 지급: **${payout.toLocaleString()}P** (지금 바로 지급돼요)`
    )
    .setColor(0xffcb05);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pet:dispatchConfirm:${userId}:${pet.slot}:${days}`).setLabel("파견 보내기").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pet:dispatchCancel:${userId}:${pet.slot}`).setLabel("취소").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// userId + days are embedded in the customId (no slot list - componentHandler
// re-resolves which pets are still dispatchable at click time instead of
// trusting a snapshot from when this prompt was built, so a pet that gets
// dispatched/released by some other action in between can't be double-acted
// on or 404 silently).
function buildDispatchAllConfirmMessage(pets, userId, days) {
  const payoutEach = dispatchPayout(days);
  const totalPayout = payoutEach * pets.length;
  const names = pets.map((p) => `${p.slot}번 ${p.nickname ?? p.speciesName}`).join(", ");

  const embed = new EmbedBuilder()
    .setTitle(`${pets.length}마리를 ${days}일간 파견 보낼까요?`)
    .setDescription(
      `${names}\n\n` +
        `⚠️ 한 번 시작하면 **중간에 되돌릴 수 없어요.**\n` +
        `파견 중엔 이 펫들에게 밥주기/놀아주기/진화/파양을 할 수 없어요.\n\n` +
        `확정 지급: **${totalPayout.toLocaleString()}P** (마리당 ${payoutEach.toLocaleString()}P, 지금 바로 지급돼요)`
    )
    .setColor(0xffcb05);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pet:dispatchAllConfirm:${userId}:${days}`).setLabel("전부 파견 보내기").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pet:dispatchAllCancel:${userId}:${days}`).setLabel("취소").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildDispatchAllResultMessage(result) {
  const lines = [];
  if (result.dispatched.length > 0) {
    const totalPayout = result.dispatched.reduce((sum, r) => sum + r.payout, 0);
    const names = result.dispatched.map((r) => `${r.pet.slot}번 ${r.pet.nickname ?? r.pet.speciesName}`).join(", ");
    lines.push(
      `🚚 ${result.dispatched.length}마리를 ${result.dispatched[0].days}일간 파견 보냈어요! (${names})\n**+${totalPayout.toLocaleString()}P** 획득!`
    );
  }
  if (result.skipped.length > 0) {
    const names = result.skipped.map((s) => `${s.pet.slot}번 ${s.pet.nickname ?? s.pet.speciesName}`).join(", ");
    lines.push(`(그 사이 파견 중이 되어 제외됨: ${names})`);
  }
  if (lines.length === 0) lines.push("지금은 보낼 수 있는 펫이 없어요.");

  return { content: lines.join("\n"), embeds: [], components: [] };
}

function buildNoDispatchableMessage() {
  return { content: "지금은 파견 보낼 수 있는 펫이 없어요. (전부 이미 파견 중이거나 펫이 없어요)", embeds: [], components: [] };
}

function buildDispatchedMessage(result) {
  const embed = new EmbedBuilder()
    .setTitle(`🚚 ${result.pet.nickname ?? result.pet.speciesName}를(을) ${result.days}일간 파견 보냈어요!`)
    .setImage(result.pet.spriteUrl)
    .setDescription(`**+${result.payout.toLocaleString()}P** 획득! ${result.days}일 후 복귀해요.`)
    .setColor(0x57f287);
  return { embeds: [embed], components: [] };
}

function buildDispatchCancelledMessage() {
  return { content: "파견을 취소했어요.", embeds: [], components: [] };
}

function buildDispatchFailureMessage(reason) {
  const msg = reason === "already-dispatched" ? "이미 파견 중이에요." : "파견을 보낼 수 없어요. 다시 시도해주세요.";
  return { content: msg, embeds: [], components: [] };
}

module.exports = {
  buildDispatchConfirmMessage,
  buildDispatchAllConfirmMessage,
  buildDispatchAllResultMessage,
  buildNoDispatchableMessage,
  buildDispatchedMessage,
  buildDispatchCancelledMessage,
  buildDispatchFailureMessage,
};
