const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const UserPoints = require("../models/user-points");
const { addPoints } = require("../points/pointsService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("포인트관리")
    .setDescription("포인트를 지급/차감합니다. (관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("지급")
        .setDescription("특정 유저에게 포인트를 지급합니다. (음수를 넣으면 차감)")
        .addUserOption((opt) => opt.setName("유저").setDescription("대상 유저").setRequired(true))
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("지급할 포인트 (음수 가능)").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("전체지급")
        .setDescription("서버의 모든 멤버에게 포인트를 지급합니다.")
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("지급할 포인트 (기본값 1000)").setMinValue(1).setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "지급") {
      const target = interaction.options.getUser("유저");
      const amount = interaction.options.getInteger("포인트");
      const record = await addPoints(interaction.guild.id, target, amount);
      return interaction.reply(
        `${target} 님에게 ${amount.toLocaleString()} 포인트를 ${amount >= 0 ? "지급" : "차감"}했습니다. (현재 ${record.points.toLocaleString()} 포인트)`
      );
    }

    if (sub === "전체지급") {
      const amount = interaction.options.getInteger("포인트") ?? UserPoints.DEFAULT_STARTING_POINTS;
      await interaction.deferReply();

      const members = await interaction.guild.members.fetch();
      const humans = members.filter((m) => !m.user.bot);

      let count = 0;
      for (const member of humans.values()) {
        await addPoints(interaction.guild.id, member.user, amount);
        count += 1;
      }

      return interaction.editReply(`${count}명의 멤버에게 ${amount.toLocaleString()} 포인트씩 지급했습니다.`);
    }
  },
};
