const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");
const PetTournament = require("../../models/pet-tournament");
const GuildPointsConfig = require("../../models/guild-points-config");
const {
  startWeeklyTournament,
  stopWeeklyTournament,
  registerParticipant,
  scheduleWeeklyTournament,
  getPetTournamentBonusBank,
  ENTRY_FEE,
  MIN_PARTICIPANTS,
} = require("../../pet/tournamentService");
const { requirePetChannel } = require("../../pet/petChannelGuard");
const missionService = require("../../points/missionService");
const { replyEphemeral, replyPublic } = require("../../interactionReply");

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

async function handleStart(interaction) {
  // Deferred immediately (before any DB work) - a successful start chains
  // several sequential DB round-trips plus an optional cross-channel
  // message send, which can blow past Discord's 3s ack window. See
  // interactionReply.js for why this matters.
  await interaction.deferReply({ ephemeral: true });

  if (!isAdmin(interaction)) {
    return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
  }

  const channelOption = interaction.options.getChannel("채널");

  // Attempted BEFORE writing the channel option to GuildPointsConfig - if the
  // cycle is already running (most likely failure), nothing should change as
  // a side effect of a command that otherwise reports failure.
  let tournament;
  try {
    tournament = await startWeeklyTournament(interaction.guild.id, interaction.user.id);
  } catch (err) {
    return replyEphemeral(interaction, { content: err.message });
  }
  scheduleWeeklyTournament(interaction.client, tournament);

  if (channelOption) {
    await GuildPointsConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { petTournamentChannelId: channelOption.id },
      { upsert: true }
    );
  }

  // Announce in the target channel itself too, not just the admin's reply
  // wherever they happened to run the command - skipped when they're the
  // same channel so people don't see the exact same message twice.
  if (channelOption && channelOption.id !== interaction.channelId) {
    try {
      const targetChannel = await interaction.client.channels.fetch(channelOption.id);
      await targetChannel.send(
        `🏆 이제부터 이 채널에 매주 펫 토너먼트 결과가 공지됩니다! 참가비 ${ENTRY_FEE.toLocaleString()} 포인트, ` +
          `\`/펫대전 신청\`으로 참가하세요. 다음 진행: <t:${Math.floor(tournament.runAt.getTime() / 1000)}:F>`
      );
    } catch (err) {
      console.error("[pet-tournament] channel setup announcement failed:", err.message);
    }
  }

  const config = channelOption ? { petTournamentChannelId: channelOption.id } : await GuildPointsConfig.findOne({ guildId: interaction.guild.id });
  const channelNote = config?.petTournamentChannelId
    ? `결과는 <#${config.petTournamentChannelId}>에 공지됩니다.`
    : "결과를 공지할 채널이 아직 지정되지 않았어요. `/펫대전 채널설정`으로 지정해주세요.";

  return replyPublic(interaction, {
    content:
      `🏆 펫 토너먼트를 시작했습니다! 참가비 ${ENTRY_FEE.toLocaleString()} 포인트, 신청은 상시 가능하며 매주 금요일 밤 9시(미국 동부시간) 마감됩니다. ` +
      `마감 후 밤 11시 30분에 자동으로 대전이 진행됩니다(다음 진행: <t:${Math.floor(tournament.runAt.getTime() / 1000)}:F>). ` +
      `최소 ${MIN_PARTICIPANTS}마리 미만이면 그 주는 취소되고 참가비가 환불돼요. \`/펫대전 신청\`으로 참가하세요 (펫마다 각각 신청할 수 있어요). ${channelNote}`,
  });
}

async function handleStop(interaction) {
  // Deferred immediately (before any DB work) - stopWeeklyTournament loops a
  // refund (DB write) per registered pet before replying, which can blow
  // past Discord's 3s ack window on a tournament with many entrants. See
  // interactionReply.js for why this matters.
  await interaction.deferReply({ ephemeral: true });

  if (!isAdmin(interaction)) {
    return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
  }
  try {
    await stopWeeklyTournament(interaction.guild.id);
  } catch (err) {
    return replyEphemeral(interaction, { content: err.message });
  }
  return replyPublic(interaction, { content: "펫 토너먼트를 종료했습니다. 이번 주 신청자에게는 참가비가 전액 환불되었고, 자동 진행은 더 이상 없습니다." });
}

async function handleChannelSet(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
  }
  const channel = interaction.options.getChannel("채널");
  await GuildPointsConfig.findOneAndUpdate(
    { guildId: interaction.guild.id },
    { petTournamentChannelId: channel.id },
    { upsert: true }
  );
  return interaction.reply({
    content: `앞으로 펫 토너먼트 결과(그리고 참가자 부족으로 취소될 때의 공지)를 ${channel}로 보냅니다.`,
    ephemeral: true,
  });
}

async function handleRegister(interaction) {
  // Deferred immediately (before any DB work) - registerParticipant deducts
  // the entry fee via a DB round-trip before replying, which can blow past
  // Discord's 3s ack window on a slow connection. See interactionReply.js
  // for why this matters (a failed reply() after the fee was already
  // deducted used to look like registration failed).
  await interaction.deferReply({ ephemeral: true });

  let pet;
  try {
    ({ pet } = await registerParticipant(interaction.guild.id, interaction.user, interaction.options.getInteger("슬롯")));
  } catch (err) {
    return replyEphemeral(interaction, { content: err.message });
  }

  const petLabel = pet.nickname ? `${pet.nickname}(${pet.speciesName})` : pet.speciesName;
  await replyPublic(interaction, {
    content:
      `🎫 ${petLabel}(${pet.slot}번 슬롯)로 이번 주 펫 토너먼트에 신청했습니다! (참가비 ${ENTRY_FEE.toLocaleString()} 포인트 차감) 금요일 밤 11시 30분(미국 동부시간)에 자동으로 진행됩니다. ` +
      `다른 슬롯의 펫도 \`/펫대전 신청\`으로 추가 등록할 수 있어요.`,
  });

  const missionResult = await missionService.recordAction(interaction.guild.id, interaction.user, "tournament");
  await missionService.sendMissionFollowUp(interaction, missionResult);
}

async function handleStatus(interaction) {
  const tournament = await PetTournament.findOne({ guildId: interaction.guild.id, status: "REGISTRATION" });
  if (!tournament) {
    return interaction.reply({ content: "진행중인 펫 토너먼트가 없어요.", ephemeral: true });
  }

  // Now counts pets, not people - one user can register more than one (see
  // tournamentService.registerParticipant), so this can exceed their headcount.
  const myEntryCount = tournament.participants.filter((p) => p.userId === interaction.user.id).length;
  // Just a peek (not a sweep) - the bank isn't reset until the tournament
  // actually settles, so this estimate only grows as the week goes on.
  const bankSoFar = await getPetTournamentBonusBank(interaction.guild.id);
  const pot = tournament.participants.length * ENTRY_FEE + bankSoFar;

  const embed = new EmbedBuilder()
    .setTitle("🏆 펫 토너먼트")
    .addFields(
      { name: "참가 펫", value: `${tournament.participants.length}마리 (최소 ${MIN_PARTICIPANTS}마리)`, inline: true },
      { name: "현재 예상 상금 풀", value: `${pot.toLocaleString()} 포인트`, inline: true },
      { name: "신청 마감", value: `<t:${Math.floor(tournament.registrationCloseAt.getTime() / 1000)}:F>` },
      { name: "진행 시각", value: `<t:${Math.floor(tournament.runAt.getTime() / 1000)}:F>` },
      { name: "내 신청 상태", value: myEntryCount > 0 ? `${myEntryCount}마리 신청 완료` : "미신청" }
    )
    .setColor(0xffcb05);

  return interaction.reply({ embeds: [embed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("펫대전")
    .setDescription(`매주 금요일 밤 자동 진행되는 펫 토너먼트에 참가합니다. (참가비 ${ENTRY_FEE}포인트)`)
    .addSubcommand((sub) =>
      sub
        .setName("시작")
        .setDescription("매주 반복되는 펫 토너먼트 주기를 시작합니다. (관리자 전용)")
        .addChannelOption((opt) =>
          opt
            .setName("채널")
            .setDescription("결과를 공지할 채널 (생략하면 기존에 설정된 채널을 유지)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("종료").setDescription("펫 토너먼트를 종료합니다 - 이번 주 참가비는 환불됩니다. (관리자 전용)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("채널설정")
        .setDescription("펫 토너먼트 결과를 공지할 채널을 지정합니다. (관리자 전용)")
        .addChannelOption((opt) => opt.setName("채널").setDescription("공지를 보낼 텍스트 채널").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("신청")
        .setDescription("이번 주 펫 토너먼트에 참가 신청합니다.")
        .addIntegerOption((opt) =>
          opt.setName("슬롯").setDescription("대전에 내보낼 펫의 슬롯").setMinValue(1).setMaxValue(3).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("확인").setDescription("이번 주 펫 토너먼트 진행 상황을 확인합니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // 시작/종료/채널설정 are admin setup - deliberately NOT gated by
    // requirePetChannel, since an admin needs to be able to bootstrap the
    // restriction (and run it from an admin-only channel) before a pet
    // channel is even configured. 신청/확인 are what regular players use.
    if (sub === "시작") return handleStart(interaction);
    if (sub === "종료") return handleStop(interaction);
    if (sub === "채널설정") return handleChannelSet(interaction);

    if (!(await requirePetChannel(interaction))) return;
    if (sub === "신청") return handleRegister(interaction);
    if (sub === "확인") return handleStatus(interaction);
  },
};
