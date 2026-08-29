const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { MAX_ADOPT_ATTEMPTS, ADOPT_COSTS } = require("./petService");
const { GENERATION_GROUPS } = require("./pokeApiClient");

// The live preview shown while rerolling: current candidate + how many
// reroll attempts are left. "다시 뽑기" disables itself once attempts run out,
// forcing a decision on the last candidate shown.
function buildPreviewMessage(sessionId, session) {
  const remaining = MAX_ADOPT_ATTEMPTS - session.attemptsUsed;
  const generationLabel = GENERATION_GROUPS[session.generation]?.label ?? GENERATION_GROUPS[1].label;
  const cost = ADOPT_COSTS[session.generation] ?? ADOPT_COSTS[1];

  const embed = new EmbedBuilder()
    .setTitle(`${session.candidate.displayName}, 어때요?`)
    .setImage(session.candidate.spriteUrl)
    .setDescription(
      `${generationLabel} · ${cost}P · ${session.targetSlot}번 슬롯에 입양돼요 · 시도 ${session.attemptsUsed}/${MAX_ADOPT_ATTEMPTS} · 남은 다시뽑기 **${remaining}**회`
    )
    .setColor(0xffcb05);

  const reroll = new ButtonBuilder()
    .setCustomId(`pet:reroll:${sessionId}`)
    .setLabel(remaining > 0 ? `다시 뽑기 (${remaining})` : "다시뽑기 소진")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(remaining <= 0);

  const confirm = new ButtonBuilder().setCustomId(`pet:confirm:${sessionId}`).setLabel("이 펫으로 확정!").setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(reroll, confirm)] };
}

function buildAdoptedMessage(pet) {
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${pet.speciesName}를(을) 입양했어요!`)
    .setImage(pet.spriteUrl)
    .setColor(0xffcb05)
    .setFooter({ text: "/펫정보 로 상태를 확인해보세요" });

  return { embeds: [embed], components: [] };
}

// Posted to the channel (not ephemeral) once adoption is actually finalized -
// the picker/reroll process itself stays private, only the end result is public.
function buildPublicAdoptedMessage(user, pet) {
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${user.username}님이 ${pet.speciesName}를(을) 입양했어요!`)
    .setImage(pet.spriteUrl)
    .setColor(0xffcb05);

  return { embeds: [embed] };
}

function buildExpiredMessage() {
  return { content: "선택 시간이 만료됐어요. `/펫입양`을 다시 실행해주세요.", embeds: [], components: [] };
}

function buildEligibilityFailureMessage(reason, cost) {
  if (reason === "slots-full") {
    return {
      content:
        "활성 슬롯이 모두 찼어요! 입양은 항상 빈 활성 슬롯이 있어야 가능해요.\n" +
        "`/펫보관`으로 기존 펫을 보관함에 넣어 슬롯을 비우거나, `/펫슬롯`으로 슬롯을 더 열어보세요.",
      embeds: [],
      components: [],
    };
  }
  const costNote = cost != null ? ` (${cost.toLocaleString()}P 필요해요)` : "";
  return { content: `포인트가 부족해서 확정할 수 없어요.${costNote}`, embeds: [], components: [] };
}

module.exports = { buildPreviewMessage, buildAdoptedMessage, buildPublicAdoptedMessage, buildExpiredMessage, buildEligibilityFailureMessage };
