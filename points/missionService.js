const Pet = require("../models/pet");
const PetTournament = require("../models/pet-tournament");
const { getOrCreatePoints, todayString } = require("./pointsService");

// 일일미션: 개별 보상 없음(인플레 방지) - 5개 전부 채운 날에만 지급, 연속으로
// 채운 날수에 비례해 조금 더 준다. /출석 스트릭과 같은 "어제도 받았으면 이어감,
// 아니면 1로 리셋" 규칙.
const DAILY_COMPLETE_BASE = 25;
const DAILY_STREAK_BONUS_PER_DAY = 2;
const DAILY_STREAK_CAP = 15;

// 주간미션 목표치 - 대전 참가는 카운트가 아니라 boolean이라 별도 처리.
const WEEKLY_TARGETS = { feed: 10, play: 10, alba: 5, lottery: 10 };
const WEEKLY_COMPLETE_POINTS = 100;
const WEEKLY_EXP_BUFF_MULTIPLIER = 1.15;
const WEEKLY_EXP_BUFF_DAYS = 5;

const WEEKLY_COUNT_FIELDS = {
  feed: "weeklyFeedCount",
  play: "weeklyPlayCount",
  alba: "weeklyAlbaCount",
  lottery: "weeklyLotteryCount",
};

// Monday of the week `date` falls in, using todayString()'s noon-ET day
// boundary rather than a separate midnight rule - so the weekly reset lines
// up with the same "day" everything else already uses, it just also snaps
// back to that day's Monday.
function weekString(date = new Date()) {
  const [y, m, d] = todayString(date).split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return utc.toISOString().slice(0, 10);
}

// Mutates `record` in place (caller still has to .save()) - resets every
// weekly counter/flag the moment missionWeekKey no longer matches this week.
function ensureWeekFresh(record) {
  const key = weekString();
  if (record.missionWeekKey === key) return;
  record.missionWeekKey = key;
  record.weeklyFeedCount = 0;
  record.weeklyPlayCount = 0;
  record.weeklyAlbaCount = 0;
  record.weeklyLotteryCount = 0;
  record.weeklyMissionClaimedWeekKey = undefined;
}

// Pets aren't loaded via petService.getPets here (petService requires this
// module for the exp buff + recordAction hooks, so going the other way would
// be circular) - a plain Pet query is enough for the boolean checks below.
async function getDailyMissionFlags(guildId, userId, record) {
  const today = todayString();
  const pets = await Pet.find({ guildId, userId });
  return {
    feed: pets.some((p) => p.feedsTodayDate === today && p.feedsToday > 0),
    play: pets.some((p) => p.playsTodayDate === today && p.playsToday > 0),
    alba: pets.some((p) => p.albaDate === today),
    checkin: record.lastCheckinDate === today,
    lottery: record.lotteryPlaysDate === today && record.lotteryPlaysToday > 0,
  };
}

// Awards the all-5 daily bonus exactly once per day, the first time all 5
// happen to be true. `record` is expected already-loaded (and any pending
// mutations already saved) by the caller.
async function tryAwardDailyBonus(guildId, user, record) {
  const today = todayString();
  if (record.dailyMissionBonusDate === today) return null;

  const flags = await getDailyMissionFlags(guildId, user.id, record);
  if (!Object.values(flags).every(Boolean)) return null;

  const yesterday = todayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const streak = record.dailyMissionBonusDate === yesterday ? (record.dailyMissionStreak ?? 0) + 1 : 1;
  const bonus = Math.min(DAILY_STREAK_BONUS_PER_DAY * (streak - 1), DAILY_STREAK_CAP);
  const awarded = DAILY_COMPLETE_BASE + bonus;

  record.points += awarded;
  record.dailyMissionBonusDate = today;
  record.dailyMissionStreak = streak;
  await record.save();

  return { awarded, streak };
}

// "참가" is whether the user has a live entry in the guild's currently-open
// tournament, checked fresh every time rather than a stored per-week flag.
// A stored flag can't survive a mission-week rollover: registration for a
// given tournament cycle is only possible ONCE (registerParticipant blocks
// re-registering the same slot in a still-open tournament), but that cycle
// runs Friday-to-Friday while the mission week resets Monday - so anyone who
// registered before the Monday reset would otherwise be unable to ever flip
// the flag back to true again until that Friday's run finally opens a new
// registration window, softlocking this mission for days. Deriving it live
// from "am I still registered in whatever tournament is open right now" has
// no such gap - it stays true continuously from registration through the run.
async function isJoinedOpenTournament(guildId, userId) {
  const tournament = await PetTournament.findOne({ guildId, status: "REGISTRATION" });
  return !!tournament?.participants.some((p) => p.userId === userId);
}

function isWeeklyMissionComplete(record, tournamentJoined) {
  return (
    record.weeklyFeedCount >= WEEKLY_TARGETS.feed &&
    record.weeklyPlayCount >= WEEKLY_TARGETS.play &&
    record.weeklyAlbaCount >= WEEKLY_TARGETS.alba &&
    record.weeklyLotteryCount >= WEEKLY_TARGETS.lottery &&
    tournamentJoined
  );
}

// Awards the all-5 weekly bonus once per week - points + a flat (not
// stacking) exp buff window, same "just overwrite it" reasoning as
// voicePointsService.setVoiceEventRate.
async function tryAwardWeeklyBonus(record, tournamentJoined) {
  const key = weekString();
  if (record.weeklyMissionClaimedWeekKey === key) return null;
  if (!isWeeklyMissionComplete(record, tournamentJoined)) return null;

  record.points += WEEKLY_COMPLETE_POINTS;
  record.expBuffMultiplier = WEEKLY_EXP_BUFF_MULTIPLIER;
  record.expBuffUntil = new Date(Date.now() + WEEKLY_EXP_BUFF_DAYS * 24 * 60 * 60 * 1000);
  record.weeklyMissionClaimedWeekKey = key;
  await record.save();

  return { awarded: WEEKLY_COMPLETE_POINTS, buffDays: WEEKLY_EXP_BUFF_DAYS };
}

// Central hook - call once from each of the 5 daily-mission actions
// (feed/play/alba/checkin/lottery) plus tournament registration, right after
// that action's own save. Bumps the matching weekly counter (if any), then
// auto-awards the weekly-complete and/or daily-complete bonuses the moment
// they first become true. Returns { daily, weekly } (either may be null).
// actionType "tournament" doesn't have a counter to bump - it's here only so
// registering triggers an immediate bonus check instead of waiting for the
// next /미션 or daily action (isJoinedOpenTournament covers the rest live).
async function recordAction(guildId, user, actionType) {
  const record = await getOrCreatePoints(guildId, user);
  ensureWeekFresh(record);

  const countField = WEEKLY_COUNT_FIELDS[actionType];
  if (countField) record[countField] += 1;
  await record.save();

  const tournamentJoined = await isJoinedOpenTournament(guildId, user.id);
  const weekly = await tryAwardWeeklyBonus(record, tournamentJoined);
  const daily = await tryAwardDailyBonus(guildId, user, record);

  return { daily, weekly };
}

// 1 (no buff) if expired/never set - callers multiply their exp result by
// this rather than branching on isExpBuffActive themselves.
function getExpBuffMultiplier(record) {
  if (record.expBuffUntil && record.expBuffUntil.getTime() > Date.now()) {
    return record.expBuffMultiplier ?? 1;
  }
  return 1;
}

function isExpBuffActive(record) {
  return !!(record.expBuffUntil && record.expBuffUntil.getTime() > Date.now());
}

function expBuffRemainingDays(record) {
  if (!isExpBuffActive(record)) return 0;
  return Math.ceil((record.expBuffUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// Full snapshot for /미션 - read-only aside from lazily persisting a week
// rollover if one was overdue.
async function getMissionStatus(guildId, user) {
  const record = await getOrCreatePoints(guildId, user);
  const beforeKey = record.missionWeekKey;
  ensureWeekFresh(record);
  if (record.missionWeekKey !== beforeKey) await record.save();

  const daily = await getDailyMissionFlags(guildId, user.id, record);
  const dailyDone = Object.values(daily).filter(Boolean).length;

  const weekly = {
    feed: { count: record.weeklyFeedCount, target: WEEKLY_TARGETS.feed },
    play: { count: record.weeklyPlayCount, target: WEEKLY_TARGETS.play },
    alba: { count: record.weeklyAlbaCount, target: WEEKLY_TARGETS.alba },
    lottery: { count: record.weeklyLotteryCount, target: WEEKLY_TARGETS.lottery },
    tournament: await isJoinedOpenTournament(guildId, user.id),
  };
  const weeklyDone = [
    weekly.feed.count >= weekly.feed.target,
    weekly.play.count >= weekly.play.target,
    weekly.alba.count >= weekly.alba.target,
    weekly.lottery.count >= weekly.lottery.target,
    weekly.tournament,
  ].filter(Boolean).length;

  return {
    daily,
    dailyDone,
    dailyTotal: 5,
    dailyBonusClaimedToday: record.dailyMissionBonusDate === todayString(),
    dailyStreak: record.dailyMissionStreak ?? 0,
    weekly,
    weeklyDone,
    weeklyTotal: 5,
    weeklyBonusClaimedThisWeek: record.weeklyMissionClaimedWeekKey === weekString(),
    expBuffActive: isExpBuffActive(record),
    expBuffRemainingDays: expBuffRemainingDays(record),
  };
}

// Shared ephemeral follow-up text for the command layer - "" if neither
// bonus fired this call (caller should skip sending a follow-up in that case).
function buildAwardAnnouncement({ daily, weekly }) {
  const lines = [];
  if (daily) lines.push(`🎉 오늘의 미션을 모두 완료했어요! **+${daily.awarded}P** (연속 ${daily.streak}일째)`);
  if (weekly) {
    lines.push(
      `🏆 이번 주 미션을 모두 완료했어요! **+${weekly.awarded}P**, ${weekly.buffDays}일간 밥/놀아주기 EXP ${WEEKLY_EXP_BUFF_MULTIPLIER}배 버프 획득!`
    );
  }
  return lines.join("\n");
}

// Ephemeral mission-complete follow-up, sent only if this call actually
// triggered one - call after the command's own (already-sent) reply, since
// Discord requires a reply to exist before a followUp can be sent.
async function sendMissionFollowUp(interaction, missionResult) {
  if (!missionResult?.daily && !missionResult?.weekly) return;
  await interaction.followUp({ content: buildAwardAnnouncement(missionResult), ephemeral: true }).catch(() => {});
}

module.exports = {
  recordAction,
  sendMissionFollowUp,
  getMissionStatus,
  getExpBuffMultiplier,
  isExpBuffActive,
  expBuffRemainingDays,
  buildAwardAnnouncement,
  weekString,
  DAILY_COMPLETE_BASE,
  DAILY_STREAK_BONUS_PER_DAY,
  DAILY_STREAK_CAP,
  WEEKLY_TARGETS,
  WEEKLY_COMPLETE_POINTS,
  WEEKLY_EXP_BUFF_MULTIPLIER,
  WEEKLY_EXP_BUFF_DAYS,
};
