const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { addPoints, setPoints } = require("../../points/pointsService");
const { setVoiceEventRate, clearVoiceEventRate, DEFAULT_POINTS_PER_INTERVAL } = require("../../points/voicePointsService");
const { getHouseBank, spendFromHouseBank } = require("../../points/houseBankService");

// Shared by 설정/하우스지급: pick the guild members an operation should apply to.
// With no role given, that's everyone (minus bots). With a role given, it's
// members who have it - or, with exclude:true, members who DON'T have it.
// The exclude flag exists specifically for "give this role's points, but
// leave everyone else (who was never supposed to be in the points system)
// alone" corrections without touching balances people already earned through
// betting.
function pickTargets(members, role, exclude) {
  return members.filter((m) => {
    if (m.user.bot) return false;
    if (!role) return true;
    const hasRole = m.roles.cache.has(role.id);
    return exclude ? !hasRole : hasRole;
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("포인트관리")
    .setDescription("포인트를 지급/차감합니다. (관리자 전용)")
    // Administrator (not just ManageGuild): Discord actually hides a command
    // from the slash command picker entirely for members who lack this
    // permission (unless a server admin overrides it per-role in
    // Server Settings > Integrations) - it's not just a "blocked at runtime"
    // check, so this is what makes /포인트관리 invisible to non-admins.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("지급")
        .setDescription("특정 유저에게 포인트를 지급합니다. (음수를 넣으면 차감) (관리자 전용)")
        .addUserOption((opt) => opt.setName("유저").setDescription("대상 유저").setRequired(true))
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("지급할 포인트 (음수 가능)").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("설정")
        .setDescription("포인트를 더하지 않고 정확한 값으로 맞춥니다. (전체 또는 특정 역할) (관리자 전용)")
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("맞출 정확한 포인트 값").setMinValue(0).setRequired(true))
        .addRoleOption((opt) => opt.setName("역할").setDescription("이 역할을 가진 멤버만 (비워두면 전체 멤버)").setRequired(false))
        .addBooleanOption((opt) =>
          opt.setName("제외").setDescription("반대로 이 역할이 없는 멤버만 대상으로 (역할 옵션과 함께 사용)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("보이스이벤트")
        .setDescription("보이스채널 5분당 지급 포인트를 임시로 바꿉니다 (금요일 이벤트 등). (관리자 전용)")
        .addIntegerOption((opt) =>
          opt
            .setName("포인트")
            .setDescription(`5분마다 지급할 포인트 (생략하면 기본값 ${DEFAULT_POINTS_PER_INTERVAL}로 복구)`)
            .setMinValue(0)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("시간")
            .setDescription("몇 분 후 자동으로 기본값 복구할지 (생략하면 수동으로 복구 전까지 유지)")
            .setMinValue(1)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("복구").setDescription("true로 설정하면 포인트/시간 무시하고 즉시 기본값으로 복구").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("하우스지급")
        .setDescription("추첨식 복권 하우스컷으로 모인 포인트에서 보너스를 지급합니다. (관리자 전용)")
        .addIntegerOption((opt) => opt.setName("포인트").setDescription("1인당 지급할 포인트").setMinValue(1).setRequired(true))
        .addUserOption((opt) => opt.setName("유저").setDescription("특정 유저에게만 지급 (비워두면 전체/역할 대상)").setRequired(false))
        .addRoleOption((opt) => opt.setName("역할").setDescription("이 역할을 가진 멤버에게만 지급 (비워두면 전체 멤버)").setRequired(false))
        .addBooleanOption((opt) =>
          opt.setName("제외").setDescription("반대로 이 역할이 없는 멤버에게만 지급").setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("하우스잔액").setDescription("하우스 포인트 잔액을 확인합니다. (관리자 전용)")),

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

    if (sub === "설정") {
      const amount = interaction.options.getInteger("포인트");
      const role = interaction.options.getRole("역할");
      const exclude = interaction.options.getBoolean("제외") ?? false;
      await interaction.deferReply();

      const members = await interaction.guild.members.fetch();
      const targets = pickTargets(members, role, exclude);

      if (targets.size === 0) {
        return interaction.editReply(role ? "조건에 맞는 멤버가 없어요." : "대상 멤버가 없어요.");
      }

      let count = 0;
      for (const member of targets.values()) {
        await setPoints(interaction.guild.id, member.user, amount);
        count += 1;
      }

      const who = role ? `<@&${role.id}> 역할이 ${exclude ? "없는" : "있는"} ${count}명` : `${count}명의 멤버`;
      return interaction.editReply(`${who}의 포인트를 ${amount.toLocaleString()}(으)로 맞췄습니다.`);
    }

    if (sub === "보이스이벤트") {
      const revert = interaction.options.getBoolean("복구") ?? false;
      const points = interaction.options.getInteger("포인트");
      const minutes = interaction.options.getInteger("시간");

      if (revert) {
        await clearVoiceEventRate(interaction.guild.id);
        return interaction.reply(`보이스채널 지급 포인트를 기본값(5분당 ${DEFAULT_POINTS_PER_INTERVAL}포인트)으로 되돌렸습니다.`);
      }

      if (points == null) {
        return interaction.reply({
          content: "`포인트` 값을 입력하거나, 기본값으로 되돌리려면 `복구:true`로 실행해주세요.",
          ephemeral: true,
        });
      }

      await setVoiceEventRate(interaction.guild.id, points, minutes);
      const durationText = minutes
        ? `${minutes}분 후 자동으로 기본값으로 복구됩니다.`
        : "`/포인트관리 보이스이벤트 복구:true`로 되돌리기 전까지 계속 유지됩니다.";
      return interaction.reply(`보이스채널 지급 포인트를 5분당 ${points.toLocaleString()}포인트로 변경했습니다. ${durationText}`);
    }

    if (sub === "하우스잔액") {
      const balance = await getHouseBank(interaction.guild.id);
      return interaction.reply({ content: `현재 하우스 잔액: **${balance.toLocaleString()}** 포인트`, ephemeral: true });
    }

    if (sub === "하우스지급") {
      const amount = interaction.options.getInteger("포인트");
      const targetUser = interaction.options.getUser("유저");
      const role = interaction.options.getRole("역할");
      const exclude = interaction.options.getBoolean("제외") ?? false;
      await interaction.deferReply();

      let targetUsers;
      if (targetUser) {
        targetUsers = [targetUser];
      } else {
        const members = await interaction.guild.members.fetch();
        targetUsers = [...pickTargets(members, role, exclude).values()].map((m) => m.user);
      }

      if (targetUsers.length === 0) {
        return interaction.editReply(role ? "조건에 맞는 멤버가 없어요." : "지급할 멤버가 없어요.");
      }

      const totalNeeded = amount * targetUsers.length;
      try {
        await spendFromHouseBank(interaction.guild.id, totalNeeded);
      } catch (err) {
        return interaction.editReply(err.message);
      }

      for (const user of targetUsers) {
        await addPoints(interaction.guild.id, user, amount);
      }

      const remaining = await getHouseBank(interaction.guild.id);
      const who = targetUser
        ? `${targetUser}`
        : role
          ? `<@&${role.id}> 역할이 ${exclude ? "없는" : "있는"} ${targetUsers.length}명`
          : `${targetUsers.length}명의 멤버`;
      return interaction.editReply(
        `하우스 잔액에서 ${who}에게 ${amount.toLocaleString()} 포인트씩 지급했습니다. (남은 하우스 잔액: ${remaining.toLocaleString()} 포인트)`
      );
    }
  },
};
