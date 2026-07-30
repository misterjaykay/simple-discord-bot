const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { adoptPet, ADOPT_COST } = require("../pet/petService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫입양")
    .setDescription(`(테스트 중, 관리자 전용) 포인트 ${ADOPT_COST}를 써서 랜덤 포켓몬 펫을 입양합니다.`)
    // Administrator hides the command from the slash command picker entirely
    // for non-admins (not just a runtime block) - pet feature is still being
    // tested, remove this line to open it up to everyone.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply();
    const result = await adoptPet(interaction.guild.id, interaction.user);

    if (!result.ok) {
      if (result.reason === "already-have-pet") {
        return interaction.editReply("이미 펫이 있어요! `/펫정보`로 확인해보세요.");
      }
      if (result.reason === "not-enough-points") {
        return interaction.editReply(`포인트가 부족해요. 입양 비용은 **${ADOPT_COST}**포인트예요.`);
      }
      if (result.reason === "no-eligible-species") {
        return interaction.editReply("입양 가능한 포켓몬을 찾지 못했어요. 잠시 후 다시 시도해주세요.");
      }
      return interaction.editReply("입양하는 중 오류가 발생했습니다.");
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${result.pet.speciesName}를(을) 입양했어요!`)
      .setImage(result.pet.spriteUrl)
      .setColor(0xffcb05)
      .setFooter({ text: "/펫정보 로 상태를 확인해보세요" });

    return interaction.editReply({ embeds: [embed] });
  },
};
