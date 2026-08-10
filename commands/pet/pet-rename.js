const { SlashCommandBuilder } = require("discord.js");
const { getPet } = require("../../pet/petService");

const MAX_NICKNAME_LENGTH = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫이름변경")
    .setDescription("펫의 이름(닉네임)을 바꿉니다.")
    .addStringOption((opt) =>
      opt.setName("이름").setDescription(`새 이름 (최대 ${MAX_NICKNAME_LENGTH}자)`).setMaxLength(MAX_NICKNAME_LENGTH).setRequired(true)
    ),
  async execute(interaction) {
    const pet = await getPet(interaction.guild.id, interaction.user.id);
    if (!pet) {
      return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 먼저 입양해보세요!", ephemeral: true });
    }

    const newName = interaction.options.getString("이름").trim();
    if (!newName) {
      return interaction.reply({ content: "이름을 입력해주세요.", ephemeral: true });
    }

    const oldName = pet.nickname ?? pet.speciesName;
    pet.nickname = newName;
    await pet.save();

    return interaction.reply(`${oldName}의 이름을 **${newName}**(으)로 바꿨어요!`);
  },
};
