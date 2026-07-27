const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const Prediction = require("../models/prediction");
const { addPoints } = require("../points/pointsService");
const { buildPredictionMessage, refreshPredictionMessage } = require("../prediction/predictionView");
const { lockPrediction, scheduleAutoLock, clearScheduledLock } = require("../prediction/predictionService");

// Test-run lockdown: require actual Administrator (owner or an Administrator
// role), not just "Manage Server" - so nobody can spam-create/lock/settle
// predictions while this is still being tried out. Once there's a dedicated
// admin role and per-command permissions are set up in Discord's own
// Integrations settings, this can be relaxed back to ManageGuild if wanted.
function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

async function refundAllBets(guildId, prediction) {
  for (const bet of prediction.bets) {
    await addPoints(guildId, { id: bet.userId, username: bet.username }, bet.amount);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("예측")
    .setDescription("포인트를 걸고 승패를 예측하는 미니게임입니다. (트위치 예측과 비슷해요)")
    .addSubcommand((sub) =>
      sub
        .setName("생성")
        .setDescription("새 예측을 만듭니다. (관리자 전용)")
        .addStringOption((opt) => opt.setName("질문").setDescription("예: 오늘 경기 이길까요?").setRequired(true))
        .addStringOption((opt) => opt.setName("옵션1").setDescription("예: 승리").setRequired(true))
        .addStringOption((opt) => opt.setName("옵션2").setDescription("예: 패배").setRequired(true))
        .addStringOption((opt) => opt.setName("옵션3").setDescription("세 번째 옵션 (선택)").setRequired(false))
        .addStringOption((opt) => opt.setName("옵션4").setDescription("네 번째 옵션 (선택)").setRequired(false))
        .addIntegerOption((opt) =>
          opt
            .setName("시간")
            .setDescription("몇 분 후 자동으로 마감할지 (비워두면 /예측 마감 으로 직접 마감)")
            .setMinValue(1)
            .setMaxValue(10080)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("채널")
            .setDescription("예측을 올릴 채널 (비워두면 이 명령어를 입력한 채널)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("마감").setDescription("베팅을 마감합니다. (관리자 전용)"))
    .addSubcommand((sub) =>
      sub
        .setName("종료")
        .setDescription("결과를 확정하고 포인트를 정산합니다. (관리자 전용)")
        .addIntegerOption((opt) => opt.setName("승리옵션").setDescription("몇 번 옵션이 이겼는지 (1부터 시작)").setMinValue(1).setMaxValue(4).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("취소").setDescription("예측을 취소하고 모두 환불합니다. (관리자 전용)"))
    .addSubcommand((sub) => sub.setName("확인").setDescription("현재 진행중인 예측 상태를 봅니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "확인") {
      const active = await Prediction.findOne({ guildId, status: { $in: ["OPEN", "LOCKED"] } });
      if (!active) {
        return interaction.reply({ content: "현재 진행중인 예측이 없습니다.", ephemeral: true });
      }
      return interaction.reply(buildPredictionMessage(active));
    }

    // Every other subcommand mutates state, so it's admin-only. Not using
    // setDefaultMemberPermissions on the whole command because "확인" above
    // should stay open to everyone.
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
    }

    if (sub === "생성") {
      const existing = await Prediction.findOne({ guildId, status: { $in: ["OPEN", "LOCKED"] } });
      if (existing) {
        return interaction.reply({
          content: "이미 진행중인 예측이 있습니다. 먼저 `/예측 종료` 또는 `/예측 취소`로 마무리해주세요.",
          ephemeral: true,
        });
      }

      const question = interaction.options.getString("질문");
      const options = ["옵션1", "옵션2", "옵션3", "옵션4"].map((key) => interaction.options.getString(key)).filter(Boolean);
      const minutes = interaction.options.getInteger("시간");
      const lockAt = minutes ? new Date(Date.now() + minutes * 60 * 1000) : undefined;
      const targetChannel = interaction.options.getChannel("채널") ?? interaction.channel;

      const botPermissions = targetChannel.permissionsFor(interaction.guild.members.me);
      if (!botPermissions?.has(PermissionFlagsBits.SendMessages) || !botPermissions?.has(PermissionFlagsBits.ViewChannel)) {
        return interaction.reply({
          content: `<#${targetChannel.id}> 채널에 메시지를 보낼 권한이 없어요. 봇 권한을 확인해주세요.`,
          ephemeral: true,
        });
      }

      const prediction = await Prediction.create({
        guildId,
        channelId: targetChannel.id,
        question,
        options,
        createdBy: interaction.user.id,
        lockAt,
      });

      const message = await targetChannel.send(buildPredictionMessage(prediction));
      prediction.messageId = message.id;
      await prediction.save();

      if (lockAt) {
        scheduleAutoLock(interaction.client, prediction);
      }

      if (targetChannel.id === interaction.channel.id) {
        await interaction.reply({ content: "예측을 생성했습니다.", ephemeral: true });
      } else {
        await interaction.reply({ content: `<#${targetChannel.id}> 채널에 예측을 올렸습니다.`, ephemeral: true });
      }
      return;
    }

    const active = await Prediction.findOne({ guildId, status: { $in: ["OPEN", "LOCKED"] } });
    if (!active) {
      return interaction.reply({ content: "진행중인 예측이 없습니다.", ephemeral: true });
    }

    if (sub === "마감") {
      if (active.status !== "OPEN") {
        return interaction.reply({ content: "이미 마감된 예측입니다.", ephemeral: true });
      }
      clearScheduledLock(active._id);
      await lockPrediction(interaction.client, active._id, { announce: false });
      await interaction.reply("베팅을 마감했습니다. 더 이상 베팅을 받지 않습니다.");
      return;
    }

    if (sub === "취소") {
      clearScheduledLock(active._id);
      await refundAllBets(guildId, active);
      active.status = "CANCELLED";
      await active.save();
      await interaction.reply("예측을 취소하고 모든 베팅을 환불했습니다.");
      await refreshPredictionMessage(interaction.client, active, true);
      return;
    }

    if (sub === "종료") {
      const winningOptionIndex = interaction.options.getInteger("승리옵션") - 1;
      if (winningOptionIndex >= active.options.length) {
        return interaction.reply({ content: "존재하지 않는 옵션 번호입니다.", ephemeral: true });
      }

      const winningBets = active.bets.filter((b) => b.optionIndex === winningOptionIndex);
      const totalPot = active.bets.reduce((sum, b) => sum + b.amount, 0);
      const winningPot = winningBets.reduce((sum, b) => sum + b.amount, 0);

      if (winningBets.length === 0) {
        // Nobody bet on the winning option - void the prediction, refund everyone.
        await refundAllBets(guildId, active);
        active.status = "CANCELLED";
        await active.save();
        await interaction.reply("승리 옵션에 베팅한 사람이 없어서 예측을 무효 처리하고 전액 환불했습니다.");
        await refreshPredictionMessage(interaction.client, active, true);
        return;
      }

      const payouts = [];
      for (const bet of winningBets) {
        const payout = Math.round(bet.amount * (totalPot / winningPot));
        await addPoints(guildId, { id: bet.userId, username: bet.username }, payout);
        payouts.push({ userId: bet.userId, payout });
      }

      active.status = "RESOLVED";
      active.winningOptionIndex = winningOptionIndex;
      await active.save();

      const summary =
        payouts
          .sort((a, b) => b.payout - a.payout)
          .map((p) => `<@${p.userId}> +${p.payout.toLocaleString()}`)
          .join("\n") || "없음";

      await interaction.reply(
        `**${active.options[winningOptionIndex]}** 결과로 정산되었습니다!\n총 판돈: ${totalPot.toLocaleString()} 포인트\n\n${summary}`
      );
      await refreshPredictionMessage(interaction.client, active, true);
      return;
    }
  },
};
