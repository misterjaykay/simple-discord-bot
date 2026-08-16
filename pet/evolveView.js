const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { EVOLVE_COST } = require("./petService");

// userId + slot are embedded in the customId (no session store needed - the
// options themselves already live durably on the Pet doc) so the component
// handler can reject anyone but the person who ran /진화 and knows exactly
// which pet this choice is for.
function buildEvolveChoiceMessage(pet, userId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`pet:evolveChoice:${userId}:${pet.slot}`)
    .setPlaceholder("진화시킬 모습을 선택하세요")
    .addOptions(pet.nextEvolutionOptions.map((o) => ({ label: o.speciesName, value: String(o.speciesId) })));

  const embed = new EmbedBuilder()
    .setTitle(`${pet.nickname ?? pet.speciesName}이(가) 여러 갈래로 진화할 수 있어요!`)
    .setImage(pet.spriteUrl)
    .setDescription(`포인트 ${EVOLVE_COST}를 사용해서 원하는 모습으로 진화시켜보세요.`)
    .setColor(0xffcb05);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildEvolvedMessage(result) {
  const embed = new EmbedBuilder()
    .setTitle(`✨ ${result.from} → ${result.to}(으)로 진화했어요!`)
    .setImage(result.pet.spriteUrl)
    .setColor(0xffcb05);
  return { content: "", embeds: [embed], components: [] };
}

function buildEvolveFailureMessage(reason) {
  if (reason === "not-enough-points") {
    return { content: `포인트가 부족해요. 진화 비용은 **${EVOLVE_COST}**포인트예요.`, embeds: [], components: [] };
  }
  if (reason === "not-ready") {
    return { content: "아직 진화 조건을 만족하지 못했어요.", embeds: [], components: [] };
  }
  if (reason === "invalid-choice") {
    return { content: "이미 지난 선택지예요. `/진화`를 다시 실행해주세요.", embeds: [], components: [] };
  }
  if (reason === "dispatched") {
    return { content: "이 펫은 파견 중이라 진화시킬 수 없어요.", embeds: [], components: [] };
  }
  return { content: "진화 중 오류가 발생했어요.", embeds: [], components: [] };
}

module.exports = { buildEvolveChoiceMessage, buildEvolvedMessage, buildEvolveFailureMessage };
