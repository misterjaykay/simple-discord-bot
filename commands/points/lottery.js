const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");
const Lottery = require("../../models/lottery");
const { getOrCreatePoints, todayString } = require("../../points/pointsService");
const missionService = require("../../points/missionService");
const {
  startLottery,
  stopLottery,
  buyTickets,
  setAnnounceChannel,
  runDraw,
  scheduleWeeklyDraw,
  addJackpotContribution,
  formatDrawResultMessage,
  totalTickets,
  totalPot,
  JACKPOT_HIT_CHANCE,
  DEFAULT_MAX_TICKETS_PER_PERSON,
  SEED_JACKPOT,
  DEFAULT_TICKET_PRICE,
} = require("../../points/lotteryDrawService");
const { replyEphemeral, replyPublic } = require("../../interactionReply");
const { INSTANCE_ID } = require("../../instanceId");

// ---- 즉석복권 (/복권 긁기) ----

// Fixed payout table, ordered by ascending cumulative probability. Deliberately
// has a house edge - expected return is ~0.8035x the ticket amount - same
// reasoning as a real scratch lottery: this is meant to be a fun points sink,
// not a reliable way to grind points (that's what voice/chat/출석/예측 are for).
// 꽝 was tuned down from 70% to 65% (a bare "70%" felt too harsh once the odds
// table started being shown on every play) with the freed probability shifted
// mostly into 반값, not the big-multiplier tiers - so winning something is
// just as common as before, big prizes are a bit rarer, and the overall
// return rate stayed close to where it was.
// Later, players kept complaining it "never pays out" even though the return
// rate looked reasonable on paper - turned out the real driver was that
// 꽝+반값 (net-loss outcomes) made up 84.2% of plays, not the average return.
// So 꽝 and 반값 were trimmed further and a new 2배 tier added to lower that
// net-loss rate and push the return rate up - through a few more rounds of
// tuning it landed at 꽝 55.8% / 반값 19.7% / 본전 10.3% / 2배 7.7%. Once the
// ticket price itself also came down (100 -> 70, see TICKET_PRICE) to ease
// the weekly-mission grind, the 잭팟 multiplier was bumped 50x -> 70x to keep
// its absolute payout close to what it used to be (4,900 vs the old 5,000) -
// otherwise a cheaper ticket would have quietly shrunk the one prize that's
// supposed to feel huge. 3배/10배 kept their original multipliers throughout.
const TABLE = [
  { chance: 0.558, multiplier: 0, label: "꽝" },
  { chance: 0.197, multiplier: 0.5, label: "반값 당첨" },
  { chance: 0.103, multiplier: 1, label: "본전" },
  { chance: 0.077, multiplier: 2, label: "2배 당첨" },
  { chance: 0.046, multiplier: 3, label: "3배 당첨" },
  { chance: 0.017, multiplier: 10, label: "10배 당첨" },
  { chance: 0.002, multiplier: 70, label: "🎉 잭팟 70배!" },
];

// Half of every "꽝" (total loss) bet feeds the draw-style lottery's jackpot
// instead of just vanishing - the other half is still a pure sink.
const JACKPOT_FEED_PERCENT = 50;

const DAILY_PLAY_LIMIT = 5;

// Fixed ticket price - no `금액` option, so scratching a ticket is a single
// quick action instead of a decision every time. Lowered from 100 - once
// this became one of the 5 daily missions and a 10x/week weekly mission
// target, players were effectively forced to spend on top of what they're
// already pouring into pet care, so cutting the price to 70 roughly halves
// that weekly-mission cost (1,000 -> 700 points).
const TICKET_PRICE = 70;

// Only a genuinely big win (3x+) gets broadcast to the channel - 꽝/반값/본전
// results are ephemeral so 5 plays/day/person doesn't flood busy channels with
// uneventful results, while jackpot-tier wins still get their moment.
const PUBLIC_WIN_MULTIPLIER_THRESHOLD = 3;

function formatPercent(chance) {
  const pct = chance * 100;
  return `${Number(pct.toFixed(1))}%`;
}

function draw() {
  const roll = Math.random();
  let cumulative = 0;
  for (const tier of TABLE) {
    cumulative += tier.chance;
    if (roll < cumulative) return tier;
  }
  return TABLE[0]; // floating point safety net, should never actually hit this
}

// Displayed best-outcome-first (reverse of TABLE's cumulative-probability
// order) - leading with "꽝 70%" reads as much harsher than leading with the
// jackpot/big wins does, even though the odds themselves are unchanged.
function oddsTableText() {
  return [...TABLE]
    .reverse()
    .map((t) => `${formatPercent(t.chance)} - ${t.label}`)
    .join("\n");
}

async function handleScratch(interaction) {
  // Acknowledge immediately (defer) rather than waiting until after the DB
  // round-trips below to reply - a slow Mongo connection can easily blow past
  // Discord's 3s ack window, which throws on interaction.reply() *after* the
  // play count has already been saved. That used to look like "the scratch
  // failed" to the user while still silently burning one of their 5 daily
  // plays, so a few of those in a row could hit the limit long before the
  // user believed they'd played 5 times. Deferring ephemerally buys 15
  // minutes and costs nothing visible - most outcomes stay ephemeral anyway,
  // and big wins get deleted+re-sent as a public followUp below.
  // Diagnostic logging kept around (see commit history) - now backed by a
  // real fix: index.js claims every interaction id exactly once (see
  // interactionClaim.js) before command.execute() is even called, closing
  // the Railway-rolling-deploy overlap that caused this. These lines stay so
  // a repeat is still traceable from Railway logs.
  const debugId = interaction.id;
  console.log(`[lottery] scratch start instance=${INSTANCE_ID} id=${debugId} user=${interaction.user.id} at=${new Date().toISOString()}`);

  await interaction.deferReply({ ephemeral: true });

  const amount = TICKET_PRICE;
  const guildId = interaction.guild.id;
  const record = await getOrCreatePoints(guildId, interaction.user);

  const today = todayString();
  if (record.lotteryPlaysDate !== today) {
    record.lotteryPlaysDate = today;
    record.lotteryPlaysToday = 0;
  }

  if (record.lotteryPlaysToday >= DAILY_PLAY_LIMIT) {
    console.log(`[lottery] scratch blocked id=${debugId} plays=${record.lotteryPlaysToday} at=${new Date().toISOString()}`);
    return interaction.editReply({
      content: `오늘 즉석복권은 ${DAILY_PLAY_LIMIT}번 다 사용했어요. 내일 다시 도전해주세요!`,
    });
  }

  if (record.points < amount) {
    return interaction.editReply({
      content: `포인트가 부족해요. (현재 ${record.points.toLocaleString()} 포인트)`,
    });
  }

  const tier = draw();
  const payout = Math.round(amount * tier.multiplier);
  const net = payout - amount;

  const playsBefore = record.lotteryPlaysToday;
  record.points += net;
  record.lotteryPlaysToday += 1;
  record.username = interaction.user.username ?? record.username;
  await record.save();
  console.log(
    `[lottery] scratch saved instance=${INSTANCE_ID} id=${debugId} plays=${playsBefore}->${record.lotteryPlaysToday} at=${new Date().toISOString()}`
  );

  if (tier.multiplier === 0) {
    const jackpotCut = Math.round((amount * JACKPOT_FEED_PERCENT) / 100);
    await addJackpotContribution(guildId, jackpotCut).catch((err) =>
      console.error("[lottery] failed to feed jackpot contribution:", err.message)
    );
  }

  const playsLeft = DAILY_PLAY_LIMIT - record.lotteryPlaysToday;
  const embed = new EmbedBuilder()
    .setTitle("🎫 즉석복권")
    .setDescription(`${tier.label}!\n${amount.toLocaleString()} 포인트를 걸어서 ${payout.toLocaleString()} 포인트를 받았어요.`)
    .addFields({ name: "확률표", value: oddsTableText() })
    .setColor(net > 0 ? 0x57f287 : net === 0 ? 0xf1c40f : 0xed4245)
    .setFooter({ text: `순손익: ${net >= 0 ? "+" : ""}${net.toLocaleString()} 포인트 · 평균 회수율 80.35% · 오늘 남은 횟수: ${playsLeft}` });

  const isBigWin = tier.multiplier >= PUBLIC_WIN_MULTIPLIER_THRESHOLD;
  if (isBigWin) {
    // The defer above was ephemeral (so small/losing results stay quiet) -
    // big wins need to actually be visible in the channel, so drop the
    // ephemeral placeholder and post the real result as a public followUp.
    await interaction.deleteReply().catch(() => {});
    await interaction.followUp({ embeds: [embed], ephemeral: false });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }

  const missionResult = await missionService.recordAction(guildId, interaction.user, "lottery");
  await missionService.sendMissionFollowUp(interaction, missionResult);
}

// ---- 추첨식 복권 (/복권 추첨 ...) ----

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function myTicketLine(lottery, userId) {
  const total = totalTickets(lottery);
  const mine = lottery.tickets.find((t) => t.userId === userId)?.count || 0;
  const share = total > 0 ? formatPercent(mine / total) : "0%";
  return `당신의 티켓: ${mine}장 / 총 ${total}장 (약 ${share}) · 이번 주 당첨자가 나올 확률: ${Math.round(JACKPOT_HIT_CHANCE * 100)}%`;
}

async function handleDraw(interaction, sub) {
  // Deferred immediately (before any DB work) - every branch below does at
  // least one DB round-trip before its reply, and 종료/뽑기 loop a DB write
  // per ticket holder / call runDraw's own multi-step payout chain, which can
  // blow past Discord's 3s ack window. See interactionReply.js for why this
  // matters (a failed reply() after a draw already resolved or a refund
  // already went out used to look like the command failed while it hadn't -
  // retrying 뽑기 in particular would draw again for real).
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild.id;

  if (sub === "확인") {
    const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
    if (!lottery) {
      return replyEphemeral(interaction, { content: "진행중인 추첨 라운드가 없어요." });
    }

    const drawLine = lottery.drawAt ? `⏰ 다음 추첨: <t:${Math.floor(lottery.drawAt.getTime() / 1000)}:F> (<t:${Math.floor(lottery.drawAt.getTime() / 1000)}:R>)\n` : "";

    const embed = new EmbedBuilder()
      .setTitle("🎟️ 추첨 복권")
      .setDescription(`${drawLine}${myTicketLine(lottery, interaction.user.id)}`)
      .addFields(
        { name: "티켓 가격", value: `${lottery.ticketPrice.toLocaleString()} 포인트`, inline: true },
        { name: "판매된 티켓", value: `${totalTickets(lottery)}장 (1인당 최대 ${lottery.maxTicketsPerPerson || DEFAULT_MAX_TICKETS_PER_PERSON}장)`, inline: true },
        { name: "현재 판돈", value: `${totalPot(lottery).toLocaleString()} 포인트`, inline: true }
      )
      .setFooter({
        text:
          lottery.bonusPot > 0
            ? `그 중 ${lottery.bonusPot.toLocaleString()} 포인트는 잭팟(즉석복권 유입 + 이월분)이에요`
            : "잭팟 보너스 없음 - 즉석복권 꽝이나 이월 시 여기로 쌓여요",
      })
      .setColor(0xf1c40f);
    return replyPublic(interaction, { embeds: [embed] });
  }

  if (sub === "시작") {
    if (!isAdmin(interaction)) {
      return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
    }
    const maxTickets = interaction.options.getInteger("최대티켓") ?? DEFAULT_MAX_TICKETS_PER_PERSON;

    let lottery;
    try {
      lottery = await startLottery(guildId, interaction.user.id, DEFAULT_TICKET_PRICE, maxTickets, interaction.channelId);
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }
    scheduleWeeklyDraw(interaction.client, lottery);

    return replyPublic(interaction, {
      content:
        `🎟️ 추첨 복권을 시작했습니다! 티켓 1장 = ${DEFAULT_TICKET_PRICE.toLocaleString()} 포인트 (1인당 최대 ${maxTickets}장). ` +
        `기본 잭팟 ${SEED_JACKPOT.toLocaleString()} 포인트로 시작합니다. ` +
        `매주 토요일 밤 11:30(미국 동부시간)에 자동 추첨되며, 다음 추첨은 <t:${Math.floor(lottery.drawAt.getTime() / 1000)}:F>입니다. ` +
        "`/복권 추첨 구매`로 참여하세요. 추첨 30분 전엔 이 채널에 공지, 10분 전엔 그때까지 티켓을 산 분들께 알림, 추첨 직후엔 결과까지 이 채널로 보내드려요.",
    });
  }

  if (sub === "종료") {
    if (!isAdmin(interaction)) {
      return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
    }
    try {
      await stopLottery(guildId);
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }
    return replyPublic(interaction, { content: "추첨 복권을 종료했습니다. 이번 라운드에 구매된 티켓은 전액 환불되었고, 자동 추첨은 더 이상 진행되지 않습니다." });
  }

  if (sub === "구매") {
    const count = interaction.options.getInteger("개수");
    try {
      const lottery = await buyTickets(guildId, interaction.user, count);
      return replyPublic(interaction, {
        content: `🎟️ 티켓 ${count}장을 구매했습니다. 현재 판돈: ${totalPot(lottery).toLocaleString()} 포인트\n${myTicketLine(lottery, interaction.user.id)}`,
      });
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }
  }

  if (sub === "뽑기") {
    if (!isAdmin(interaction)) {
      return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
    }
    try {
      const result = await runDraw(guildId, interaction.client);
      return replyPublic(interaction, { content: formatDrawResultMessage(result) });
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }
  }

  if (sub === "채널설정") {
    if (!isAdmin(interaction)) {
      return replyEphemeral(interaction, { content: "이 명령어는 서버 관리자만 사용할 수 있어요." });
    }
    const channel = interaction.options.getChannel("채널");
    try {
      await setAnnounceChannel(guildId, channel.id, interaction.client);
    } catch (err) {
      return replyEphemeral(interaction, { content: err.message });
    }
    return replyEphemeral(interaction, {
      content: `앞으로 이 라운드(그리고 자동으로 이어지는 다음 라운드들)의 30분 전 공지/10분 전 알림/추첨 결과를 전부 ${channel}로 보냅니다.`,
    });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("복권")
    .setDescription(`즉석복권을 긁거나(/복권 긁기), 매주 자동 추첨되는 잭팟 복권에 참여합니다(/복권 추첨 ...).`)
    .addSubcommand((sub) => sub.setName("긁기").setDescription(`즉석복권을 긁습니다. (티켓 ${TICKET_PRICE}포인트 고정)`))
    .addSubcommandGroup((group) =>
      group
        .setName("추첨")
        .setDescription("매주 토요일 밤 11:30(미국 동부시간) 자동 추첨되는 잭팟 복권 - 당첨자가 없으면 다음주로 이월돼요.")
        .addSubcommand((sub) =>
          sub
            .setName("시작")
            .setDescription(`추첨 라운드를 시작합니다 (티켓 ${DEFAULT_TICKET_PRICE}포인트 고정) - 그 뒤로는 매주 자동으로 추첨/이월됩니다. (관리자 전용)`)
            .addIntegerOption((opt) =>
              opt
                .setName("최대티켓")
                .setDescription(`1인당 최대 구매 가능 티켓 수 (기본값 ${DEFAULT_MAX_TICKETS_PER_PERSON})`)
                .setMinValue(1)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("구매")
            .setDescription("추첨 티켓을 구매합니다.")
            .addIntegerOption((opt) => opt.setName("개수").setDescription("구매할 티켓 수").setMinValue(1).setRequired(true))
        )
        .addSubcommand((sub) => sub.setName("확인").setDescription("현재 라운드 상태를 봅니다."))
        .addSubcommand((sub) => sub.setName("뽑기").setDescription("지금 바로 추첨합니다 (자동 추첨을 기다리지 않고). (관리자 전용)"))
        .addSubcommand((sub) => sub.setName("종료").setDescription("추첨을 완전히 종료합니다 - 티켓은 환불됩니다. (관리자 전용)"))
        .addSubcommand((sub) =>
          sub
            .setName("채널설정")
            .setDescription("추첨 30분 전 공지/10분 전 알림/추첨 결과를 보낼 채널을 다시 지정합니다 (진행중인 라운드에도 바로 적용). (관리자 전용)")
            .addChannelOption((opt) => opt.setName("채널").setDescription("알림을 보낼 텍스트 채널").addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (!group && sub === "긁기") {
      return handleScratch(interaction);
    }

    if (group === "추첨") {
      return handleDraw(interaction, sub);
    }
  },
};
