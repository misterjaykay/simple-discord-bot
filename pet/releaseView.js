const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ADOPT_COST } = require("./petService");

// userId is embedded in the customId (no session store needed - unlike the
// adopt flow, this is a single yes/no with no intermediate state) so the
// component handler can reject anyone but the person who ran /펫파양.
function buildReleaseConfirmMessage(pet, userId) {
  const embed = new EmbedBuilder()
    .setTitle(`정말 ${pet.nickname ?? pet.speciesName}를(을) 파양하시겠어요?`)
    .setImage(pet.spriteUrl)
    .setDescription(
      `Lv.${pet.level}까지 키운 기록이 전부 사라지고, 되돌릴 수 없어요.\n` +
        `새 펫을 입양하려면 \`/펫입양\`으로 ${ADOPT_COST.toLocaleString()} 포인트를 다시 내야 해요.`
    )
    .setColor(0xed4245);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pet:releaseConfirm:${userId}`).setLabel("파양하기").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`pet:releaseCancel:${userId}`).setLabel("취소").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildReleasedMessage(pet) {
  const embed = new EmbedBuilder()
    .setTitle(`${pet.nickname ?? pet.speciesName}를(을) 파양했어요`)
    .setDescription("새 펫을 입양하려면 `/펫입양`을 사용하세요.")
    .setColor(0x99aab5);
  return { embeds: [embed], components: [] };
}

function buildReleaseCancelledMessage() {
  return { content: "파양을 취소했어요.", embeds: [], components: [] };
}

function buildNoPetToReleaseMessage() {
  return { content: "파양할 펫이 없어요. `/펫입양`으로 먼저 입양해보세요!", embeds: [], components: [] };
}

module.exports = { buildReleaseConfirmMessage, buildReleasedMessage, buildReleaseCancelledMessage, buildNoPetToReleaseMessage };
