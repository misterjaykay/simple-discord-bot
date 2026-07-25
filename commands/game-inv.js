const { SlashCommandBuilder } = require("discord.js");

const GAME_ROLES = {
  롤: "668342413110280194",
  파스트: "769411358541348865",
  영원회귀: "766816114482872361",
  어몽어스: "769803570614632458",
  굶지마: "769417112208015361",
  동숲: "769677499427979284",
  테이블탑: "770486652224143362",
};

const ALLOWED_ROLE_ID = "749687210013491303";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("게임초대")
    .setDescription("함께 게임할 사람을 모집합니다.")
    .addStringOption((opt) =>
      opt
        .setName("게임")
        .setDescription("모집할 게임")
        .setRequired(true)
        .addChoices(...Object.keys(GAME_ROLES).map((name) => ({ name, value: name })))
    ),
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: "이 명령어를 실행시킬 수 있는 권한이 없습니다.", ephemeral: true });
    }
    const game = interaction.options.getString("게임");
    const roleId = GAME_ROLES[game];
    return interaction.reply(`<@&${roleId}>\n게임명: ${game}\n하실분을 모집합니다.`);
  },
};
