const { EmbedBuilder } = require("discord.js");
const { MAX_STORAGE } = require("./petService");

// /펫보관함 - just a status listing, no buttons (store/retrieve are plain
// immediate commands, same as feed/play - nothing here needs confirmation).
function buildStorageListMessage(storagePets) {
  const embed = new EmbedBuilder().setTitle("📦 펫 보관함").setColor(0x99aab5);

  if (storagePets.length === 0) {
    embed.setDescription(`보관 중인 펫이 없어요. (\`/펫보관 슬롯:번호\`로 활성 슬롯의 펫을 보관할 수 있어요)`);
    return { embeds: [embed] };
  }

  const lines = storagePets.map((p) => `${p.storageSlot}번 - ${p.nickname ?? p.speciesName} (Lv.${p.level})`);
  embed.setDescription(`${lines.join("\n")}\n\n${storagePets.length}/${MAX_STORAGE}칸 사용 중 · \`/펫꺼내기\`로 활성 슬롯에 다시 꺼낼 수 있어요.`);
  return { embeds: [embed] };
}

module.exports = { buildStorageListMessage };
