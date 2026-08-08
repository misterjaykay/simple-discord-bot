// Lets /맵, /요원 (and anything else that takes a map/agent name) accept either
// the English name stored in the DB (models/match.js `map`, models/player-match-stat.js
// `agent`) or a common Korean alias, without needing two separate command options.
//
// Maintenance note: the agent list grows whenever Riot ships a new agent -
// add a line here when that happens, or that agent's stats just won't match
// a Korean alias until someone does (English input still works either way).

const MAP_ALIASES = {
  어센트: "Ascent",
  바인드: "Bind",
  헤이븐: "Haven",
  스플릿: "Split",
  아이스박스: "Icebox",
  브리즈: "Breeze",
  프랙처: "Fracture",
  펄: "Pearl",
  로터스: "Lotus",
  선셋: "Sunset",
  어비스: "Abyss",
  코로드: "Corrode",
};

const AGENT_ALIASES = {
  브림스톤: "Brimstone",
  바이퍼: "Viper",
  오멘: "Omen",
  킬조이: "Killjoy",
  사이퍼: "Cypher",
  소바: "Sova",
  세이지: "Sage",
  피닉스: "Phoenix",
  제트: "Jett",
  레이나: "Reyna",
  레이즈: "Raze",
  브리치: "Breach",
  스카이: "Skye",
  요루: "Yoru",
  아스트라: "Astra",
  케이오: "KAY/O",
  체임버: "Chamber",
  네온: "Neon",
  페이드: "Fade",
  하버: "Harbor",
  게코: "Gekko",
  데드락: "Deadlock",
  아이소: "Iso",
  클로브: "Clove",
  바이스: "Vyse",
  테호: "Tejo",
  웨이레이: "Waylay",
};

function normalize(input, aliasTable) {
  const trimmed = input.trim();
  const alias = aliasTable[trimmed];
  return alias ?? trimmed; // no match -> pass the raw input through as-is (still tried against the DB, case-insensitively)
}

function normalizeMapName(input) {
  return normalize(input, MAP_ALIASES);
}

function normalizeAgentName(input) {
  return normalize(input, AGENT_ALIASES);
}

module.exports = { MAP_ALIASES, AGENT_ALIASES, normalizeMapName, normalizeAgentName };
