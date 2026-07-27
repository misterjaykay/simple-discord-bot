const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const UserPoints = require("../models/user-points");
const { addPoints, setPoints } = require("../points/pointsService");

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
        .setDescription("서버의 모든 멤버(또는 특정 역할)에게 포인트를 지급합니다.")
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("지급할 포인트 (기본값 1000)").setMinValue(1).setRequired(false))
        .addRoleOption((opt) => opt.setName("역할").setDescription("이 역할을 가진 멤버에게만 지급 (비워두면 전체 멤버)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("설정")
        .setDescription("포인트를 더하지 않고 정확한 값으로 맞춥니다. (전체 또는 특정 역할)")
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("맞출 정확한 포인트 값").setMinValue(0).setRequired(true))
        .addRoleOption((opt) => opt.setName("역할").setDescription("이 역할을 가진 멤버만 (비워두면 전체 멤버)").setRequired(false))
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
      const role = interaction.options.getRole("역할");
      await interaction.deferReply();

      const members = await interaction.guild.members.fetch();
      const targets = members.filter((m) => !m.user.bot && (!role || m.roles.cache.has(role.id)));

      if (targets.size === 0) {
        return interaction.editReply(role ? `<@&${role.id}> 역할을 가진 멤버가 없어요.` : "지급할 멤버가 없어요.");
      }

      let count = 0;
      for (const member of targets.values()) {
        await addPoints(interaction.guild.id, member.user, amount);
        count += 1;
      }

      const who = role ? `<@&${role.id}> 역할을 가진 ${count}명` : `${count}명의 멤버`;
      return interaction.editReply(`${who}에게 ${amount.toLocaleString()} 포인트씩 지급했습니다.`);
    }

    if (sub === "설정") {
      const amount = interaction.options.getInteger("포인트");
      const role = interaction.options.getRole("역할");
      await interaction.deferReply();

      const members = await interaction.guild.members.fetch();
      const targets = members.filter((m) => !m.user.bot && (!role || m.roles.cache.has(role.id)));

      if (targets.size === 0) {
        return interaction.editReply(role ? `<@&${role.id}> 역할을 가진 멤버가 없어요.` : "대상 멤버가 없어요.");
      }

      let count = 0;
      for (const member of targets.values()) {
        await setPoints(interaction.guild.id, member.user, amount);
        count += 1;
      }

      const who = role ? `<@&${role.id}> 역할을 가진 ${count}명` : `${count}명의 멤버`;
      return interaction.editReply(`${who}의 포인트를 ${amount.toLocaleString()}(으)로 맞췄습니다.`);
    }
  },
};
