const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getPet,
  getPets,
  getDisplayStats,
  ensureEvolutionOptions,
  isEvolutionReady,
  isDispatched,
  dispatchRemainingDays,
  isAlbaAvailableToday,
} = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

function bar(value) {
  const filled = Math.round(value / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// showSlot prefixes the title with the slot number - only turned on when
// showing multiple pets at once (a single-pet owner's title stays exactly as
// it was before slots existed). Caller must have already awaited
// ensureEvolutionOptions(pet) so nextEvolutionOptions/isEvolutionReady are
// accurate even for pets that predate branch-choice evolution.
function buildPetEmbed(pet, { showSlot = false } = {}) {
  const stats = getDisplayStats(pet);
  const ready = isEvolutionReady(pet);
  const dispatched = isDispatched(pet);
  const albaField = dispatched
    ? { name: "🚚 파견 중", value: `약 ${dispatchRemainingDays(pet)}일 후 복귀 (밥주기/놀아주기/진화/파양 불가)` }
    : { name: "오늘의 알바", value: isAlbaAvailableToday(pet) ? "가능 (`/펫알바`)" : "완료" };
  const evolutionField = ready
    ? { name: "✨ 진화 가능!", value: "`/진화`로 지금 진화시킬 수 있어요!" }
    : {
        name: "진화",
        value: pet.nextEvolutionMinLevel
          ? `Lv.${pet.nextEvolutionMinLevel}에 진화 가능 (현재 Lv.${pet.level})`
          : "더 이상 진화하지 않아요 (최종 진화형)",
      };

  return new EmbedBuilder()
    .setTitle(showSlot ? `${pet.slot}번 슬롯 · ${pet.nickname ?? pet.speciesName}` : pet.nickname ?? pet.speciesName)
    .setImage(pet.spriteUrl)
    .addFields(
      { name: "포켓몬", value: pet.speciesName, inline: true },
      { name: "레벨", value: `Lv.${pet.level} (${pet.exp}/${stats.expNeeded} exp)`, inline: true },
      { name: "배고픔", value: `${bar(stats.hunger)} ${stats.hunger}%` },
      { name: "친밀도", value: `${bar(stats.happiness)} ${stats.happiness}%` },
      evolutionField,
      albaField,
      { name: "토너먼트 전적", value: `🏆 우승 ${pet.tournamentWins}회 / 🥈 준우승 ${pet.tournamentRunnerUps}회` }
    )
    .setColor(ready ? 0x57f287 : 0xffcb05);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫정보")
    .setDescription("내 펫의 상태를 확인합니다. 슬롯을 지정하지 않으면 보유한 펫을 모두 보여줘요.")
    .addIntegerOption((opt) => opt.setName("슬롯").setDescription("확인할 펫의 슬롯").setMinValue(1).setMaxValue(3)),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const requestedSlot = interaction.options.getInteger("슬롯");
    if (requestedSlot != null) {
      const pet = await getPet(interaction.guild.id, interaction.user.id, requestedSlot);
      if (!pet) {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      await ensureEvolutionOptions(pet);
      return interaction.reply({ embeds: [buildPetEmbed(pet)] });
    }

    const pets = await getPets(interaction.guild.id, interaction.user.id);
    if (pets.length === 0) {
      return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
    }

    await Promise.all(pets.map((pet) => ensureEvolutionOptions(pet)));
    return interaction.reply({ embeds: pets.map((pet) => buildPetEmbed(pet, { showSlot: pets.length > 1 })) });
  },
};
