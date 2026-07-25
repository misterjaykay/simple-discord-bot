const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("인자정보")
    .setDescription("입력한 내용을 그대로 보여주는 테스트용 명령어입니다.")
    .addStringOption((opt) => opt.setName("내용").setDescription("아무 텍스트나 입력해보세요.").setRequired(false)),
  async execute(interaction) {
    const value = interaction.options.getString("내용");
    if (!value) {
      return interaction.reply(`아무 내용도 입력하지 않으셨어요, ${interaction.user}!`);
    }
    if (value === "foo") {
      return interaction.reply("bar");
    }
    return interaction.reply(`입력한 내용: ${value}`);
  },
};
