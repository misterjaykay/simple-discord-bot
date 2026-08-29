const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ADOPT_COSTS, formatSlotChoices } = require("./petService");
const { GENERATION_GROUPS } = require("./pokeApiClient");

const adoptCostSummary = Object.entries(ADOPT_COSTS)
  .map(([gen, cost]) => `${GENERATION_GROUPS[gen].label} ${cost.toLocaleString()}P`)
  .join(" / ");

// userId + slot are embedded in the customId (no session store needed -
// unlike the adopt flow, this is a single yes/no with no intermediate state)
// so the component handler can reject anyone but the person who ran /펫파양
// and knows exactly which slot to delete.
function buildReleaseConfirmMessage(pet, userId) {
  const embed = new EmbedBuilder()
    .setTitle(`정말 ${pet.nickname ?? pet.speciesName}(${pet.slot}번 슬롯)를(을) 파양하시겠어요?`)
    .setImage(pet.spriteUrl)
    .setDescription(
      `Lv.${pet.level}까지 키운 기록이 전부 사라지고, 되돌릴 수 없어요.\n` +
        `이 슬롯에 새 펫을 입양하려면 \`/펫입양\`으로 포인트(${adoptCostSummary})를 다시 내야 해요.\n` +
        `-# 기록을 지우고 싶지 않다면 \`/펫보관\`으로 대신 보관함에 넣어둘 수도 있어요.`
    )
    .setColor(0xed4245);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pet:releaseConfirm:${userId}:${pet.slot}`).setLabel("파양하기").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`pet:releaseCancel:${userId}:${pet.slot}`).setLabel("취소").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// Shown when /펫파양 is run without a 슬롯 option, the user has 2+ pets, and
// none of them is the currently active one (see petService.resolvePetForAction).
function buildNoActivePetMessage(pets) {
  return {
    content: `여러 마리를 키우고 있어요: ${formatSlotChoices(pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫파양 슬롯:번호\`로 직접 지정해주세요.`,
    embeds: [],
    components: [],
  };
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

module.exports = {
  buildReleaseConfirmMessage,
  buildNoActivePetMessage,
  buildReleasedMessage,
  buildReleaseCancelledMessage,
  buildNoPetToReleaseMessage,
};
