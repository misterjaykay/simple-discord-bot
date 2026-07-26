const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const Prediction = require("../models/prediction");
const { getOrCreatePoints } = require("../points/pointsService");
const { refreshPredictionMessage } = require("./predictionView");

async function handlePredictionComponent(interaction) {
  const { customId } = interaction;

  // Clicking an option button just opens a modal asking how many points to bet.
  if (customId.startsWith("pred:bet:")) {
    const optionIndex = Number(customId.split(":")[2]);
    const prediction = await Prediction.findOne({ guildId: interaction.guild.id, status: "OPEN" });
    if (!prediction) {
      return interaction.reply({ content: "이 예측은 더 이상 베팅을 받지 않습니다.", ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId(`pred:bet_modal:${optionIndex}`).setTitle(`"${prediction.options[optionIndex]}"에 베팅`);
    const amountInput = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("베팅할 포인트")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("예: 100")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    return interaction.showModal(modal);
  }

  if (customId.startsWith("pred:bet_modal:")) {
    const optionIndex = Number(customId.split(":")[2]);
    const amountRaw = interaction.fields.getTextInputValue("amount");
    const amount = Number.parseInt(amountRaw, 10);

    if (!Number.isInteger(amount) || amount <= 0) {
      return interaction.reply({ content: "1 이상의 정수로 입력해주세요.", ephemeral: true });
    }

    const prediction = await Prediction.findOne({ guildId: interaction.guild.id, status: "OPEN" });
    if (!prediction) {
      return interaction.reply({ content: "이 예측은 더 이상 베팅을 받지 않습니다.", ephemeral: true });
    }

    // One option per user per prediction - can top up the same option, but can't
    // switch sides once you've bet (matches how Twitch predictions work).
    const existingBet = prediction.bets.find((b) => b.userId === interaction.user.id);
    if (existingBet && existingBet.optionIndex !== optionIndex) {
      return interaction.reply({
        content: `이미 **${prediction.options[existingBet.optionIndex]}**에 베팅하셨어요. 한 예측에는 하나의 옵션에만 베팅할 수 있습니다.`,
        ephemeral: true,
      });
    }

    const record = await getOrCreatePoints(interaction.guild.id, interaction.user);
    if (record.points < amount) {
      return interaction.reply({ content: `포인트가 부족합니다. (현재 ${record.points.toLocaleString()} 포인트)`, ephemeral: true });
    }

    record.points -= amount;
    await record.save();

    if (existingBet) {
      existingBet.amount += amount;
    } else {
      prediction.bets.push({ userId: interaction.user.id, username: interaction.user.username, optionIndex, amount });
    }
    await prediction.save();

    await interaction.reply({
      content: `**${prediction.options[optionIndex]}**에 ${amount.toLocaleString()} 포인트를 베팅했습니다. (남은 포인트: ${record.points.toLocaleString()})`,
      ephemeral: true,
    });

    await refreshPredictionMessage(interaction.client, prediction);
  }
}

module.exports = { handlePredictionComponent };
