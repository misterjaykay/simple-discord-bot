const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPet, getDisplayStats } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

function bar(value) {
  const filled = Math.round(value / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫정보")
    .setDescription("내 펫의 상태를 확인합니다."),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const pet = await getPet(interaction.guild.id, interaction.user.id);
    if (!pet) {
      return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
    }

    const stats = getDisplayStats(pet);
    const evolutionText = pet.nextEvolutionMinLevel
      ? `Lv.${pet.nextEvolutionMinLevel}에 진화 예정 ✨`
      : "더 이상 진화하지 않아요 (최종 진화형)";

    const embed = new EmbedBuilder()
      .setTitle(pet.nickname ?? pet.speciesName)
      .setImage(pet.spriteUrl)
      .addFields(
        { name: "포켓몬", value: pet.speciesName, inline: true },
        { name: "레벨", value: `Lv.${pet.level} (${pet.exp}/${stats.expNeeded} exp)`, inline: true },
        { name: "배고픔", value: `${bar(stats.hunger)} ${stats.hunger}%` },
        { name: "친밀도", value: `${bar(stats.happiness)} ${stats.happiness}%` },
        { name: "진화", value: evolutionText },
        { name: "토너먼트 전적", value: `🏆 우승 ${pet.tournamentWins}회 / 🥈 준우승 ${pet.tournamentRunnerUps}회` }
      )
      .setColor(0xffcb05);

    return interaction.reply({ embeds: [embed] });
  },
};
