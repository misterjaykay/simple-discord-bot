const { SlashCommandBuilder } = require("discord.js");
const { getPet } = require("../../pet/petService");
const { buildReleaseConfirmMessage, buildNoPetToReleaseMessage } = require("../../pet/releaseView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder().setName("펫파양").setDescription("지금 키우고 있는 펫을 파양합니다. (되돌릴 수 없어요)"),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const pet = await getPet(interaction.guild.id, interaction.user.id);
    if (!pet) {
      return interaction.reply({ ...buildNoPetToReleaseMessage(), ephemeral: true });
    }
    return interaction.reply({ ...buildReleaseConfirmMessage(pet, interaction.user.id), ephemeral: true });
  },
};
