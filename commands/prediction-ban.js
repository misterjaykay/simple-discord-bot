const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { banFromPrediction, unbanFromPrediction, getBanStatus, banMessage, formatDuration } = require("../prediction/predictionBanService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("예측제재")
    .setDescription("특정 유저의 예측(/예측) 베팅 참여를 제한합니다. (모더레이터 전용)")
    // ModerateMembers ("멤버 타임아웃" 권한) 기준으로 기본 노출 - Discord가 이 권한이
    // 없는 멤버에게는 명령어 자체를 안 보여준다. 관리자만 쓰게 하고 싶으면 그대로 두고,
    // 전담 모더레이터 역할에게도 열어주고 싶으면 서버 설정 > 연동(Integrations) >
    // 이 봇 > /예측제재 에서 그 역할을 직접 추가해주면 된다 (역할 자체에 멤버 타임아웃
    // 권한이 없어도 됨 - Discord가 명령어별로 개별 허용해주는 기능).
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("부여")
        .setDescription("유저의 예측 베팅 참여를 제한합니다.")
        .addUserOption((opt) => opt.setName("유저").setDescription("제재할 유저").setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName("기간").setDescription("제한 시간(분) - 비워두면 직접 해제하기 전까지 무기한").setMinValue(1).setRequired(false)
        )
        .addStringOption((opt) => opt.setName("사유").setDescription("제재 사유 (선택)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("해제")
        .setDescription("유저의 예측 베팅 제한을 해제합니다.")
        .addUserOption((opt) => opt.setName("유저").setDescription("해제할 유저").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("확인")
        .setDescription("유저가 현재 예측 제재 중인지 확인합니다.")
        .addUserOption((opt) => opt.setName("유저").setDescription("확인할 유저").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const target = interaction.options.getUser("유저");

    if (sub === "부여") {
      const minutes = interaction.options.getInteger("기간");
      const reason = interaction.options.getString("사유");
      await banFromPrediction(guildId, target, minutes, reason);

      const durationLine = minutes ? `${formatDuration(minutes)} 동안` : "직접 해제하기 전까지 무기한으로";
      const reasonLine = reason ? ` (사유: ${reason})` : "";
      return interaction.reply({
        content: `🚫 <@${target.id}>님의 예측 베팅 참여를 ${durationLine} 제한했습니다${reasonLine}.`,
        ephemeral: true,
      });
    }

    if (sub === "해제") {
      await unbanFromPrediction(guildId, target);
      return interaction.reply({ content: `✅ <@${target.id}>님의 예측 베팅 제한을 해제했습니다.`, ephemeral: true });
    }

    if (sub === "확인") {
      const status = await getBanStatus(guildId, target);
      if (!status.banned) {
        return interaction.reply({ content: `<@${target.id}>님은 현재 예측 제재 중이 아니에요.`, ephemeral: true });
      }
      return interaction.reply({ content: `<@${target.id}>님: ${banMessage(status)}`, ephemeral: true });
    }
  },
};
