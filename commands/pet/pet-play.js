const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { playWithPet, PLAY_COST, MAX_PLAYS_PER_DAY } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫놀아주기")
    .setDescription(`포인트 ${PLAY_COST}를 써서 펫과 놀아줍니다.`),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const result = await playWithPet(interaction.guild.id, interaction.user);

    if (!result.ok) {
      if (result.reason === "no-pet") {
        return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!", ephemeral: true });
      }
      if (result.reason === "cooldown") {
        return interaction.reply({
          content: `아직 놀고 싶어하지 않아요. ${formatRemaining(result.remainingMs)} 후에 다시 놀아주세요.`,
          ephemeral: true,
        });
      }
      if (result.reason === "not-enough-points") {
        return interaction.reply({ content: `포인트가 부족해요. 놀이 비용은 **${PLAY_COST}**포인트예요.`, ephemeral: true });
      }
      if (result.reason === "daily-limit") {
        return interaction.reply({
          content: `오늘은 이미 ${MAX_PLAYS_PER_DAY}번 놀아줬어요. 내일 다시 놀아주세요!`,
          ephemeral: true,
        });
      }
      return interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true });
    }

    const levelMsg = result.leveledUp ? ` 🎊 레벨업! 지금 Lv.${result.pet.level}` : "";
    const displayName = result.evolvedTo?.from ?? result.pet.nickname ?? result.pet.speciesName;
    const content = `🎾 ${displayName}와(과) 신나게 놀아줬어요!${levelMsg}`;

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
