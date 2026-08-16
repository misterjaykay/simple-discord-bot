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
  buildDispatchedMessage,
  buildDispatchCancelledMessage,
  buildDispatchFailureMessage,
};
