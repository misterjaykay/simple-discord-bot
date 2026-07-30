const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getPet, getDisplayStats } = require("../pet/petService");

function bar(value) {
  const filled = Math.round(value / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫정보")
    .setDescription("(테스트 중, 관리자 전용) 내 펫의 상태를 확인합니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
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
        { name: "종", value: pet.speciesName, inline: true },
        { name: "레벨", value: `Lv.${pet.level} (${pet.exp}/${stats.expNeeded} exp)`, inline: true },
        { name: "배고픔", value: `${bar(stats.hunger)} ${stats.hunger}%` },
        { name: "친밀도", value: `${bar(stats.happiness)} ${stats.happiness}%` },
        { name: "진화", value: evolutionText }
      )
      .setColor(0xffcb05);

    return interaction.reply({ embeds: [embed] });
  },
};
