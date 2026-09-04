const { SlashCommandBuilder } = require("discord.js");
const { getEvolutionStatus, evolvePet, EVOLVE_COST, formatSlotChoices, dispatchRemainingDays } = require("../../pet/petService");
const { requirePetChannel } = require("../../pet/petChannelGuard");
const { buildEvolveChoiceMessage, buildEvolvedMessage, buildEvolveFailureMessage } = require("../../pet/evolveView");
const { replyEphemeral, replyPublic } = require("../../interactionReply");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("진화")
    .setDescription(`포인트 ${EVOLVE_COST}를 써서 펫을 진화시킵니다.`)
    .addIntegerOption((opt) =>
      opt.setName("슬롯").setDescription("진화시킬 펫의 슬롯 (펫이 1마리뿐이면 생략 가능)").setMinValue(1).setMaxValue(3)
    ),
  async execute(interaction) {
    // Deferred immediately (before any DB/API work) - evolvePet chains
    // several sequential DB round-trips plus live PokeAPI HTTP calls, which
    // can easily blow past Discord's 3s ack window. See interactionReply.js
    // for why this matters.
    await interaction.deferReply({ ephemeral: true });

    if (!(await requirePetChannel(interaction))) return;

    const status = await getEvolutionStatus(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯"));

    if (!status.ok) {
      if (status.reason === "no-pet") {
        return replyEphemeral(interaction, { content: "아직 펫이 없어요. `/펫입양`으로 입양해보세요!" });
      }
      if (status.reason === "slot-empty") {
        return replyEphemeral(interaction, { content: "그 슬롯엔 펫이 없어요." });
      }
      if (status.reason === "no-active-pet") {
        return replyEphemeral(interaction, {
          content: `여러 마리를 키우고 있어요: ${formatSlotChoices(status.pets)}\n\`/펫슬롯\`에서 활성 펫을 선택하거나, \`/진화 슬롯:번호\`로 직접 지정해주세요.`,
        });
      }
      if (status.reason === "dispatched") {
        return replyEphemeral(interaction, {
          content: `이 펫은 파견 중이라 진화시킬 수 없어요. (복귀까지 약 ${dispatchRemainingDays(status.pet)}일)`,
        });
      }
      return replyEphemeral(interaction, { content: "오류가 발생했습니다." });
    }

    const pet = status.pet;
    if (!status.ready) {
      const levelMsg = pet.nextEvolutionMinLevel
        ? `Lv.${pet.nextEvolutionMinLevel}에 진화할 수 있어요 (현재 Lv.${pet.level}).`
        : "더 이상 진화하지 않아요 (최종 진화형).";
      return replyEphemeral(interaction, { content: `${pet.nickname ?? pet.speciesName}은(는) 아직 진화 조건을 만족하지 못했어요. ${levelMsg}` });
    }

    const options = pet.nextEvolutionOptions;

    if (options.length === 1) {
      const result = await evolvePet(interaction.guild.id, interaction.user, pet.slot, options[0].speciesId);
      if (!result.ok) return replyEphemeral(interaction, buildEvolveFailureMessage(result.reason));
      return replyPublic(interaction, buildEvolvedMessage(result));
    }

    // Ephemeral - the branch picker is private to the owner (componentHandler
    // also rejects anyone else who somehow clicks it).
    return replyEphemeral(interaction, buildEvolveChoiceMessage(pet, interaction.user.id));
  },
};
