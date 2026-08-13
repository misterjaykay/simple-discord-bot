const { SlashCommandBuilder } = require("discord.js");
const { resolvePetForAction } = require("../../pet/petService");
const { buildReleaseConfirmMessage, buildNoActivePetMessage, buildNoPetToReleaseMessage } = require("../../pet/releaseView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫파양")
    .setDescription("펫을 파양합니다. (되돌릴 수 없어요)")
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("파양할 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const resolved = await resolvePetForAction(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));
    if (!resolved.ok) {
      if (resolved.reason === "no-active-pet") {
        return interaction.reply({ ...buildNoActivePetMessage(resolved.pets), ephemeral: true });
      }
      if (resolved.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      return interaction.reply({ ...buildNoPetToReleaseMessage(), ephemeral: true });
    }
    return interaction.reply({ ...buildReleaseConfirmMessage(resolved.pet, interaction.user.id), ephemeral: true });
  },
};
