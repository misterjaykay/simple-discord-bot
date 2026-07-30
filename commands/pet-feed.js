const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { feedPet, FEED_COST } = require("../pet/petService");

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫밥주기")
    .setDescription(`(테스트 중, 관리자 전용) 포인트 ${FEED_COST}를 써서 펫에게 밥을 줍니다.`)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const result = await feedPet(interaction.guild.id, interaction.user);

    if (!result.ok) {
      if (result.reason === "no-pet") {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }
      if (result.reason === "cooldown") {
        return interaction.reply({
          content: `아직 배가 안 고파해요. ${formatRemaining(result.remainingMs)} 후에 다시 줘보세요.`,
          ephemeral: true,
        });
      }
      if (result.reason === "not-enough-points") {
        return interaction.reply({ content: `포인트가 부족해요. 밥값은 **${FEED_COST}**포인트예요.`, ephemeral: true });
      }
      return interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
    }

    const levelMsg = result.leveledUp ? ` 🎊 레벨업! 지금 Lv.${result.pet.level}` : "";
    const displayName = result.evolvedTo?.from ?? result.pet.nickname ?? result.pet.speciesName;
    const content = `🍖 ${displayName}에게 밥을 줬어요!${levelMsg}`;

    if (result.evolvedTo) {
      const embed = new EmbedBuilder()
        .setTitle(`✨ ${result.evolvedTo.from} → ${result.evolvedTo.to}(으)로 진화했어요!`)
        .setImage(result.pet.spriteUrl)
        .setColor(0xffcb05);
      return interaction.reply({ content, embeds: [embed] });
    }

    return interaction.reply(content);
  },
};
