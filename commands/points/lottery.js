const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const Lottery = require("../../models/lottery");
const { getOrCreatePoints, todayString } = require("../../points/pointsService");
const {
  startLottery,
  stopLottery,
  buyTickets,
  runDraw,
  scheduleWeeklyDraw,
  addJackpotContribution,
  totalTickets,
  totalPot,
  JACKPOT_HIT_CHANCE,
  DEFAULT_MAX_TICKETS_PER_PERSON,
  SEED_JACKPOT,
  DEFAULT_TICKET_PRICE,
} = require("../../points/lotteryDrawService");

// ---- 즉석복권 (/복권 긁기) ----

// Fixed payout table, ordered by ascending cumulative probability. Deliberately
// has a house edge - expected return is ~0.597x the ticket amount - same
// reasoning as a real scratch lottery: this is meant to be a fun points sink,
// not a reliable way to grind points (that's what voice/chat/출석/예측 are for).
// 꽝 was tuned down from 70% to 65% (a bare "70%" felt too harsh once the odds
// table started being shown on every play) with the freed probability shifted
// mostly into 반값, not the big-multiplier tiers - so winning something is
// just as common as before, big prizes are a bit rarer, and the overall
// return rate stayed close to where it was.
const TABLE = [
  { chance: 0.65, multiplier: 0, label: "꽝" },
  { chance: 0.192, multiplier: 0.5, label: "반값 당첨" },
  { chance: 0.093, multiplier: 1, label: "본전" },
  { chance: 0.046, multiplier: 3, label: "3배 당첨" },
  { chance: 0.017, multiplier: 10, label: "10배 당첨" },
  { chance: 0.002, multiplier: 50, label: "🎉 잭팟 50배!" },
];

// Half of every "꽝" (total loss) bet feeds the draw-style lottery's jackpot
// instead of just vanishing - the other half is still a pure sink.
const JACKPOT_FEED_PERCENT = 50;

const DAILY_PLAY_LIMIT = 5;

// Fixed ticket price - no `금액` option, so scratching a ticket is a single
// quick action instead of a decision every time.
const TICKET_PRICE = 100;

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
  const amount = TICKET_PRICE;
  const guildId = interaction.guild.id;
  const record = await getOrCreatePoints(guildId, interaction.user);

  const today = todayString();
  if (record.lotteryPlaysDate !== today) {
    record.lotteryPlaysDate = today;
    record.lotteryPlaysToday = 0;
  }

  if (record.lotteryPlaysToday >= DAILY_PLAY_LIMIT) {
    return interaction.reply({
      content: `오늘 즉석복권은 ${DAILY_PLAY_LIMIT}번 다 사용했어요. 내일 다시 도전해주세요!`,
      ephemeral: true,
    });
  }

  if (record.points < amount) {
    return interaction.reply({
      content: `포인트가 부족해요. (현재 ${record.points.toLocaleString()} 포인트)`,
      ephemeral: true,
    });
  }

  const tier = draw();
  const payout = Math.round(amount * tier.multiplier);
  const net = payout - amount;

  record.points += net;
  record.lotteryPlaysToday += 1;
  record.username = interaction.user.username ?? record.username;
  await record.save();

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
    .setFooter({ text: `순손익: ${net >= 0 ? "+" : ""}${net.toLocaleString()} 포인트 · 평균 회수율 59.7% · 오늘 남은 횟수: ${playsLeft}` });

  const isBigWin = tier.multiplier >= PUBLIC_WIN_MULTIPLIER_THRESHOLD;
  return interaction.reply({ embeds: [embed], ephemeral: !isBigWin });
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
  const guildId = interaction.guild.id;

  if (sub === "확인") {
    const lottery = await Lottery.findOne({ guildId, status: "OPEN" });
    if (!lottery) {
      return interaction.reply({ content: "진행중인 추첨 라운드가 없어요.", ephemeral: true });
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
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "시작") {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
    }
    const maxTickets = interaction.options.getInteger("최대티켓") ?? DEFAULT_MAX_TICKETS_PER_PERSON;

    let lottery;
    try {
      lottery = await startLottery(guildId, interaction.user.id, DEFAULT_TICKET_PRICE, maxTickets);
    } catch (err) {
      return interaction.reply({ content: err.message, ephemeral: true });
    }
    scheduleWeeklyDraw(interaction.client, lottery);

    return interaction.reply(
      `🎟️ 추첨 복권을 시작했습니다! 티켓 1장 = ${DEFAULT_TICKET_PRICE.toLocaleString()} 포인트 (1인당 최대 ${maxTickets}장). ` +
        `기본 잭팟 ${SEED_JACKPOT.toLocaleString()} 포인트로 시작합니다. ` +
        `매주 토요일 밤 11:30(미국 동부시간)에 자동 추첨되며, 다음 추첨은 <t:${Math.floor(lottery.drawAt.getTime() / 1000)}:F>입니다. ` +
        "`/복권 추첨 구매`로 참여하세요."
    );
  }

  if (sub === "종료") {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
    }
    try {
      await stopLottery(guildId);
    } catch (err) {
      return interaction.reply({ content: err.message, ephemeral: true });
    }
    return interaction.reply("추첨 복권을 종료했습니다. 이번 라운드에 구매된 티켓은 전액 환불되었고, 자동 추첨은 더 이상 진행되지 않습니다.");
  }

  if (sub === "구매") {
    const count = interaction.options.getInteger("개수");
    try {
      const lottery = await buyTickets(guildId, interaction.user, count);
      return interaction.reply(
        `🎟️ 티켓 ${count}장을 구매했습니다. 현재 판돈: ${totalPot(lottery).toLocaleString()} 포인트\n${myTicketLine(lottery, interaction.user.id)}`
      );
    } catch (err) {
      return interaction.reply({ content: err.message, ephemeral: true });
    }
  }

  if (sub === "뽑기") {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
    }
    try {
      const result = await runDraw(guildId, interaction.client);

      if (result.outcome === "no_tickets") {
        return interaction.reply(
          `아무도 티켓을 사지 않아서 이번 회차는 취소되었고, 잭팟 ${result.pot.toLocaleString()} 포인트는 다음 라운드로 이월됩니다.`
        );
      }

      if (result.outcome === "rollover") {
        return interaction.reply(
          `😮 이번엔 당첨자가 나오지 않았어요! 판돈 ${result.pot.toLocaleString()} 포인트는 전부 다음 라운드로 이월됩니다.`
        );
      }

      return interaction.reply(
        `🎉 <@${result.winnerId}> 님이 당첨되었습니다! 판돈 ${result.pot.toLocaleString()} 포인트 중 ${result.payout.toLocaleString()} 포인트를 받았습니다. (티켓 ${result.ticketsSold}장 판매)`
      );
    } catch (err) {
      return interaction.reply({ content: err.message, ephemeral: true });
    }
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
