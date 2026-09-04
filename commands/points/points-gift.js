const { SlashCommandBuilder } = require("discord.js");
const { getOrCreatePoints, addPoints } = require("../../points/pointsService");
const { replyEphemeral, replyPublic } = require("../../interactionReply");

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
    // Deferred immediately (before any DB work) - a gift is 3 sequential DB
    // round-trips (balance lookup, sender deduction, recipient credit), which
    // can blow past Discord's 3s ack window on a slow connection. See
    // interactionReply.js for why this matters.
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("유저");
    const amount = interaction.options.getInteger("포인트");

    if (target.bot) {
      return replyEphemeral(interaction, { content: "봇에게는 선물할 수 없어요." });
    }
    if (target.id === interaction.user.id) {
      return replyEphemeral(interaction, { content: "자기 자신에게는 선물할 수 없어요." });
    }

    const sender = await getOrCreatePoints(interaction.guild.id, interaction.user);
    const maxGift = Math.floor(sender.points * MAX_GIFT_PERCENT);

    if (amount > maxGift) {
      return replyEphemeral(interaction, {
        content: `보유 포인트의 ${MAX_GIFT_PERCENT * 100}%까지만 선물할 수 있어요. (현재 보유: ${sender.points.toLocaleString()}, 최대 선물 가능: ${maxGift.toLocaleString()})`,
      });
    }

    await addPoints(interaction.guild.id, interaction.user, -amount);
    await addPoints(interaction.guild.id, target, amount);

    return replyPublic(interaction, { content: `🎁 ${interaction.user}님이 ${target}님에게 **${amount.toLocaleString()}** 포인트를 선물했어요!` });
  },
};
