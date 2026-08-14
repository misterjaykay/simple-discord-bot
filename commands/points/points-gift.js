const { SlashCommandBuilder } = require("discord.js");
const { getOrCreatePoints, addPoints } = require("../../points/pointsService");

// Zero-sum transfer (doesn't inflate the economy like /포인트관리 지급 would), but
// still capped at half the sender's balance so nobody can be pressured/tricked
// into handing over their entire balance in one shot - and a floor so this
// doesn't turn into 1-포인트 spam.
const MAX_GIFT_PERCENT = 0.5;
const MIN_GIFT_AMOUNT = 50;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("포인트선물")
    .setDescription(`내 포인트를 다른 유저에게 선물합니다. (보유액의 ${MAX_GIFT_PERCENT * 100}%까지, 최소 ${MIN_GIFT_AMOUNT}포인트)`)
    .addUserOption((opt) => opt.setName("유저").setDescription("선물할 대상").setRequired(true))
    .addIntegerOption((opt) => opt.setName("포인트").setDescription("선물할 포인트").setMinValue(MIN_GIFT_AMOUNT).setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser("유저");
    const amount = interaction.options.getInteger("포인트");

    if (target.bot) {
      return interaction.reply({ content: "봇에게는 선물할 수 없어요.", ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "자기 자신에게는 선물할 수 없어요.", ephemeral: true });
    }

    const sender = await getOrCreatePoints(interaction.guild.id, interaction.user);
    const maxGift = Math.floor(sender.points * MAX_GIFT_PERCENT);

    if (amount > maxGift) {
      return interaction.reply({
        content: `보유 포인트의 ${MAX_GIFT_PERCENT * 100}%까지만 선물할 수 있어요. (현재 보유: ${sender.points.toLocaleString()}, 최대 선물 가능: ${maxGift.toLocaleString()})`,
        ephemeral: true,
      });
    }

    await addPoints(interaction.guild.id, interaction.user, -amount);
    await addPoints(interaction.guild.id, target, amount);

    return interaction.reply(`🎁 ${interaction.user}님이 ${target}님에게 **${amount.toLocaleString()}** 포인트를 선물했어요!`);
  },
};
