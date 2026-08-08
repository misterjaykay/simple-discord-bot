const { EmbedBuilder } = require("discord.js");

const VALORANT_RED = 0xff4655;

function buildPlayerStatsEmbed(player, stats) {
  const embed = new EmbedBuilder().setTitle(`📊 ${player.name} 전적`).setColor(VALORANT_RED);

  if (stats.totalGames === 0) {
    embed.setDescription("아직 기록된 경기가 없어요.");
    return { embeds: [embed] };
  }

  embed.addFields(
    { name: "전적", value: `${stats.wins}승 ${stats.losses}패 (${stats.totalGames}전)`, inline: true },
    { name: "승률", value: `${stats.winRate.toFixed(1)}%`, inline: true },
    { name: "KDA", value: `${stats.kills}/${stats.deaths}/${stats.assists} (${stats.kda.toFixed(2)})`, inline: true }
  );
  return { embeds: [embed] };
}

function buildCompositionsEmbed(combos) {
  const embed = new EmbedBuilder().setTitle(`🏆 베스트 조합 Top ${combos.length}`).setColor(VALORANT_RED);

  if (combos.length === 0) {
    embed.setDescription("아직 기록된 경기가 없어요.");
    return { embeds: [embed] };
  }

  const lines = combos.map(
    (c, i) => `**${i + 1}.** ${c.agents.join(" / ")} - ${c.wins}승 ${c.total - c.wins}패 (${c.winRate.toFixed(1)}%)`
  );
  embed.setDescription(lines.join("\n"));
  return { embeds: [embed] };
}

function buildRecentMatchesEmbed(entries) {
  const embed = new EmbedBuilder().setTitle("🕒 최근 경기").setColor(VALORANT_RED);

  if (entries.length === 0) {
    embed.setDescription("아직 기록된 경기가 없어요.");
    return { embeds: [embed] };
  }

  for (const { match, stats } of entries) {
    const resultText = match.result === "win" ? "🟢 승" : "🔴 패";
    const score = match.scoreUs != null && match.scoreThem != null ? ` (${match.scoreUs}:${match.scoreThem})` : "";
    const dateStr = new Date(match.date).toISOString().slice(0, 10);
    const playerLines = stats.map((s) => `${s.player?.name ?? "?"} - ${s.agent} ${s.kills}/${s.deaths}/${s.assists}`).join("\n");

    embed.addFields({
      name: `${dateStr} · ${match.map} · ${resultText}${score}`,
      value: playerLines || "선수 기록 없음",
    });
  }
  return { embeds: [embed] };
}

function buildMapStatsEmbed(mapStats) {
  const embed = new EmbedBuilder().setTitle(`🗺️ ${mapStats.mapName} 전적`).setColor(VALORANT_RED);

  if (mapStats.total === 0) {
    embed.setDescription("이 맵에서 기록된 경기가 없어요.");
    return { embeds: [embed] };
  }

  embed.addFields(
    { name: "전적", value: `${mapStats.wins}승 ${mapStats.losses}패 (${mapStats.total}전)`, inline: true },
    { name: "승률", value: `${mapStats.winRate.toFixed(1)}%`, inline: true }
  );
  return { embeds: [embed] };
}

function buildAgentStatsEmbed(agentStats) {
  const embed = new EmbedBuilder().setTitle(`🧑‍🤝‍🧑 ${agentStats.agentName} 전적`).setColor(VALORANT_RED);

  if (agentStats.total === 0) {
    embed.setDescription("이 요원으로 기록된 경기가 없어요.");
    return { embeds: [embed] };
  }

  embed.addFields(
    { name: "전적", value: `${agentStats.wins}승 ${agentStats.losses}패 (${agentStats.total}전)`, inline: true },
    { name: "승률", value: `${agentStats.winRate.toFixed(1)}%`, inline: true },
    { name: "KDA", value: `${agentStats.kills}/${agentStats.deaths}/${agentStats.assists} (${agentStats.kda.toFixed(2)})`, inline: true }
  );
  return { embeds: [embed] };
}

module.exports = {
  buildPlayerStatsEmbed,
  buildCompositionsEmbed,
  buildRecentMatchesEmbed,
  buildMapStatsEmbed,
  buildAgentStatsEmbed,
};
