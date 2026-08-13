const { SlashCommandBuilder } = require("discord.js");
const { resolvePetForAction, formatSlotChoices } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");

const MAX_NICKNAME_LENGTH = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫이름변경")
    .setDescription("펫의 이름(닉네임)을 바꿉니다.")
    .addStringOption((opt) =>
      opt.setName("이름").setDescription(`새 이름 (최대 ${MAX_NICKNAME_LENGTH}자)`).setMaxLength(MAX_NICKNAME_LENGTH).setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("이름을 바꿀 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    if (!(await requirePetChannel(interaction))) return;

    const resolved = await resolvePetForAction(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));
    if (!resolved.ok) {
      if (resolved.reason === "no-active-pet") {
        return interaction.reply({
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(resolved.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/펫이름변경 슬롯:번호\`로 직접 지정해주세요.`,
          ephemeral: true,
        });
      }
      if (resolved.reason === "slot-empty") {
        return interaction.reply({ content: "그 슬롯엔 펫이 없어요.", ephemeral: true });
      }
      return interaction.reply({ content: "아직 펫이 없어요. `/펫입양`으로 먼저 입양해보세요!", ephemeral: true });
    }
    const pet = resolved.pet;

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
