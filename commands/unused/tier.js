const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");

// Riot deprecated the by-name summoner lookup in 2023; lookups now go through the
// Riot ID (gameName#tagLine) account-v1 endpoint first to resolve a PUUID.
module.exports = {
  deprecated: true, // Old League of Legends tier command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("티어")
    .setDescription("리그 오브 레전드 소환사의 티어를 검색합니다. (NA 서버)")
    .addStringOption((opt) => opt.setName("게임이름").setDescription("Riot ID 게임 이름 (# 앞부분)").setRequired(true))
    .addStringOption((opt) => opt.setName("태그").setDescription("Riot ID 태그 (# 뒷부분, 예: NA1)").setRequired(true)),
  async execute(interaction) {
    const gameName = interaction.options.getString("게임이름");
    const tagLine = interaction.options.getString("태그");
    const apiKey = process.env.RIOT_API_KEY;

    if (!apiKey) {
      return interaction.reply({ content: "Riot API 키(RIOT_API_KEY)가 설정되어 있지 않습니다.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const account = await axios.get(
        `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        { headers: { "X-Riot-Token": apiKey } }
      );

      const summoner = await axios.get(`https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.data.puuid}`, {
        headers: { "X-Riot-Token": apiKey },
      });

      const entries = await axios.get(`https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summoner.data.id}`, {
        headers: { "X-Riot-Token": apiKey },
      });

      if (entries.data.length === 0) {
        return interaction.editReply(`해당 소환사 ${gameName}#${tagLine} 는 솔로랭크/자유랭크를 한 기록이 없습니다.`);
      }

      const lines = entries.data.map((e) => {
        const queueName = e.queueType === "RANKED_SOLO_5x5" ? "솔로랭크" : e.queueType === "RANKED_FLEX_SR" ? "자유랭크" : e.queueType;
        return `${queueName}: ${e.tier} ${e.rank} ${e.leaguePoints}LP`;
      });

      return interaction.editReply(`\`\`\`현재 ${gameName}#${tagLine} 소환사님의\n${lines.join("\n")}\n입니다.\`\`\``);
    } catch (err) {
      console.error(err);
      const status = err.response?.status;
      if (status === 404) {
        return interaction.editReply("해당 소환사는 존재하지 않습니다.\n**해당 검색은 NA서버만 가능합니다**");
      }
      return interaction.editReply(`에러가 발생했습니다.\n\`에러메세지: ${status ?? ""} ${err.response?.statusText ?? err.message}\``);
    }
  },
};
