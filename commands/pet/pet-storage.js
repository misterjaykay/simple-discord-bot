const { SlashCommandBuilder } = require("discord.js");
const { getStorage } = require("../../pet/petService");
const { buildStorageListMessage } = require("../../pet/storageView");
const { requirePetChannel } = require("../../pet/petChannelGuard");

module.exports = {
  data: new SlashCommandBuilder().setName("펫보관함").setDescription("보관함에 넣어둔 펫 목록을 확인합니다."),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const stored = await getStorage(interaction.guild.id, interaction.user.id);
    return interaction.reply({ ...buildStorageListMessage(stored), ephemeral: true });
  },
};
