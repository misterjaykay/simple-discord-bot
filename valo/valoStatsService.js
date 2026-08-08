const Player = require("../models/player");
const Match = require("../models/match");
const PlayerMatchStat = require("../models/player-match-stat");
const { normalizeMapName, normalizeAgentName } = require("./valoAliases");

// Regex-escapes free-text search input before using it in a RegExp - this
// data comes straight from Discord command options, not our own code.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactCaseInsensitive(text) {
  return new RegExp(`^${escapeRegex(text)}$`, "i");
}

function kda(kills, deaths, assists) {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

// Finds the tracked Player for either a @멘션 (via the link set by /발로연동)
// or a typed nickname (case-insensitive). Returns null if neither resolves.
async function resolvePlayer({ discordUserId, nickname }) {
  if (discordUserId) {
    const byDiscord = await Player.findOne({ discordUserId });
    if (byDiscord) return byDiscord;
  }
  if (nickname) {
    return Player.findOne({ name: exactCaseInsensitive(nickname) });
  }
  return null;
}

// Win rate + aggregate (career, not per-game-averaged) KDA for one player.
async function getPlayerStats(player) {
  const stats = await PlayerMatchStat.find({ player: player._id }).populate("match").lean();
  const totalGames = stats.length;
  if (totalGames === 0) return { totalGames: 0 };

  let wins = 0,
    kills = 0,
    deaths = 0,
    assists = 0;
  for (const s of stats) {
    if (s.match?.result === "win") wins += 1;
    kills += s.kills;
    deaths += s.deaths;
    assists += s.assists;
  }

  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    winRate: (wins / totalGames) * 100,
    kills,
    deaths,
    assists,
    kda: kda(kills, deaths, assists),
  };
}

// Top N agent compositions by win count, across every match regardless of
// queue size - the "composition" is just whichever set of agents shared a
// match together (2, 3, or 5 of them), so a duo and a 5-stack are never
// accidentally grouped as the same combo.
async function getTopCompositions(limit = 5) {
  const [matches, grouped] = await Promise.all([
    Match.find({}, { result: 1 }).lean(),
    PlayerMatchStat.aggregate([{ $group: { _id: "$match", agents: { $push: "$agent" } } }]),
  ]);
  const resultByMatchId = new Map(matches.map((m) => [String(m._id), m.result]));

  const combos = new Map(); // sorted-agents key -> { agents, wins, total }
  for (const { _id, agents } of grouped) {
    const result = resultByMatchId.get(String(_id));
    if (!result) continue;

    const sortedAgents = [...agents].sort();
    const key = sortedAgents.join(",");
    const combo = combos.get(key) ?? { agents: sortedAgents, wins: 0, total: 0 };
    combo.total += 1;
    if (result === "win") combo.wins += 1;
    combos.set(key, combo);
  }

  return [...combos.values()]
    .sort((a, b) => b.wins - a.wins || b.wins / b.total - a.wins / a.total)
    .slice(0, limit)
    .map((c) => ({ ...c, winRate: (c.wins / c.total) * 100 }));
}

// Most recent N matches, each with every player's agent/KDA line for that match.
async function getRecentMatches(limit = 5) {
  const matches = await Match.find({}).sort({ date: -1 }).limit(limit).lean();
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m._id);
  const stats = await PlayerMatchStat.find({ match: { $in: matchIds } }).populate("player").lean();

  const statsByMatch = new Map();
  for (const s of stats) {
    const key = String(s.match);
    if (!statsByMatch.has(key)) statsByMatch.set(key, []);
    statsByMatch.get(key).push(s);
  }

  return matches.map((match) => ({ match, stats: statsByMatch.get(String(match._id)) ?? [] }));
}

async function getMapStats(mapNameInput) {
  const mapName = normalizeMapName(mapNameInput);
  const matches = await Match.find({ map: exactCaseInsensitive(mapName) }).lean();
  const total = matches.length;
  if (total === 0) return { total: 0, mapName };

  const wins = matches.filter((m) => m.result === "win").length;
  return { total, mapName, wins, losses: total - wins, winRate: (wins / total) * 100 };
}

async function getAgentStats(agentNameInput) {
  const agentName = normalizeAgentName(agentNameInput);
  const stats = await PlayerMatchStat.find({ agent: exactCaseInsensitive(agentName) }).populate("match").lean();
  const total = stats.length;
  if (total === 0) return { total: 0, agentName };

  let wins = 0,
    kills = 0,
    deaths = 0,
    assists = 0;
  for (const s of stats) {
    if (s.match?.result === "win") wins += 1;
    kills += s.kills;
    deaths += s.deaths;
    assists += s.assists;
  }

  return {
    total,
    agentName,
    wins,
    losses: total - wins,
    winRate: (wins / total) * 100,
    kills,
    deaths,
    assists,
    kda: kda(kills, deaths, assists),
  };
}

module.exports = { resolvePlayer, getPlayerStats, getTopCompositions, getRecentMatches, getMapStats, getAgentStats };
