const { SlashCommandBuilder } = require("discord.js");
const db = require("../../models");

module.exports = {
  deprecated: true, // Old movie-poll command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("영화투표만들기")
    .setDescription("영화 투표를 새로 만듭니다.")
    .addStringOption((opt) => opt.setName("후보").setDescription("영화 후보들을 쉼표(,)로 구분해서 입력하세요.").setRequired(true)),
  async execute(interaction) {
    const raw = interaction.options.getString("후보");
    const movieList = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, id) => ({ id, name, poll: 0 }));

    if (movieList.length === 0) {
      return interaction.reply({ content: "후보를 하나 이상 입력해주세요.", ephemeral: true });
    }

    try {
      const poll = await new db.Poll({ pollId: interaction.id, choices: movieList }).save();
      const list = movieList.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      return interaction.reply(
        `투표가 생성되었습니다! (투표 ID: \`${poll.pollId}\`)\n\`\`\`${list}\`\`\`\n이 ID로 \`/투표\`, \`/투표확인\` 명령어를 사용하세요.`
      );
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "투표를 만드는 중 오류가 발생했습니다.", ephemeral: true });
    }
  },
};
