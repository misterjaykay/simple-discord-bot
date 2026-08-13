const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { MAX_SLOTS, SLOT_UNLOCK_COSTS } = require("./petService");

// notice (optional) is shown as the message content above the embed - used
// right after a successful unlock/activation so the same status view doubles
// as the confirmation, instead of a separate throwaway message.
function buildSlotStatusMessage(pets, unlockedSlots, activeSlot, userId, notice) {
  const petBySlot = new Map(pets.map((p) => [p.slot, p]));
  const lines = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    if (slot > unlockedSlots) {
      lines.push(`🔒 ${slot}번 슬롯 - 잠김 (${SLOT_UNLOCK_COSTS[slot].toLocaleString()}P로 열기)`);
      continue;
    }
    const pet = petBySlot.get(slot);
    if (!pet) {
      lines.push(`⬜ ${slot}번 슬롯 - 비어있음 (\`/펫입양\`으로 채우기)`);
      continue;
    }
    const activeMark = slot === activeSlot ? " 🎯 활성" : "";
    lines.push(`✅ ${slot}번 슬롯 - ${pet.nickname ?? pet.speciesName} (Lv.${pet.level})${activeMark}`);
  }

  const embed = new EmbedBuilder()
    .setTitle("🐾 펫 슬롯 현황")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "슬롯을 지정하지 않고 밥주기/놀아주기를 하면 🎯 활성 펫에게 적용돼요." })
    .setColor(0xffcb05);

  const buttons = [];
  const nextSlot = unlockedSlots + 1;
  if (nextSlot <= MAX_SLOTS) {
    const cost = SLOT_UNLOCK_COSTS[nextSlot];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`pet:unlockSlot:${userId}`)
        .setLabel(`${nextSlot}번 슬롯 열기 (${cost.toLocaleString()}P)`)
        .setStyle(ButtonStyle.Success)
    );
  }

  // Only offer activation for slots that actually have a pet and aren't
  // already active - nothing meaningful to switch to/from otherwise.
  for (let slot = 1; slot <= unlockedSlots; slot++) {
    if (slot === activeSlot || !petBySlot.has(slot)) continue;
    buttons.push(
      new ButtonBuilder().setCustomId(`pet:activateSlot:${userId}:${slot}`).setLabel(`${slot}번 슬롯 활성화`).setStyle(ButtonStyle.Primary)
    );
  }

  const components = buttons.length > 0 ? [new ActionRowBuilder().addComponents(...buttons)] : [];
  return { content: notice ?? "", embeds: [embed], components };
}

module.exports = { buildSlotStatusMessage };
