const { SlashCommandBuilder } = require("discord.js");
const TempVoiceChannel = require("../models/temp-voice-channel");
const { replyEphemeral, replyPublic } = require("../interactionReply");

const REGION_CHOICES = [
  { name: "자동", value: "automatic" },
  { name: "대한민국", value: "south-korea" },
  { name: "일본", value: "japan" },
  { name: "홍콩", value: "hongkong" },
  { name: "싱가포르", value: "singapore" },
  { name: "인도", value: "india" },
  { name: "시드니", value: "sydney" },
  { name: "러시아", value: "russia" },
  { name: "남아프리카", value: "southafrica" },
  { name: "브라질", value: "brazil" },
  { name: "유럽(로테르담)", value: "rotterdam" },
  { name: "미국 서부", value: "us-west" },
  { name: "미국 동부", value: "us-east" },
  { name: "미국 중부", value: "us-central" },
  { name: "미국 남부", value: "us-south" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("보이스채널")
    .setDescription("보이스마스터로 만든 내 채널을 관리합니다.")
    .addSubcommand((sub) =>
      sub.setName("이름").setDescription("채널 이름을 변경합니다.").addStringOption((opt) => opt.setName("이름").setDescription("새 채널 이름").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("인원제한")
        .setDescription("채널 인원 제한을 변경합니다.")
        .addIntegerOption((opt) => opt.setName("인원").setDescription("0은 무제한").setMinValue(0).setMaxValue(99).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("잠금").setDescription("채널을 잠급니다. (입장 차단, 채널은 계속 보임)"))
    .addSubcommand((sub) => sub.setName("잠금해제").setDescription("채널 잠금을 해제합니다."))
    .addSubcommand((sub) => sub.setName("숨기기").setDescription("채널을 목록에서 아예 보이지 않게 숨깁니다."))
    .addSubcommand((sub) => sub.setName("보이기").setDescription("숨긴 채널을 다시 목록에 보이게 합니다."))
    .addSubcommand((sub) =>
      sub
        .setName("지역")
        .setDescription("채널의 음성 서버 지역을 변경합니다.")
        .addStringOption((opt) => opt.setName("지역").setDescription("변경할 지역").setRequired(true).addChoices(...REGION_CHOICES))
    )
    .addSubcommand((sub) =>
      sub
        .setName("비트레이트")
        .setDescription("채널의 음질(비트레이트)을 변경합니다. 서버 부스트 등급에 따라 최대치가 다릅니다.")
        .addIntegerOption((opt) => opt.setName("kbps").setDescription("8~384 사이 (서버 부스트 등급 이상은 적용 안 됨)").setMinValue(8).setMaxValue(384).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("소유권가져오기").setDescription("방장이 자리를 비운 채널의 소유권을 가져옵니다.")),

  async execute(interaction) {
    // Deferred immediately (before any DB/API work) - every subcommand below
    // does a DB lookup plus at least one Discord API call before replying,
    // and 소유권가져오기 chains two role API calls plus a DB save - any of
    // which can blow past Discord's 3s ack window. See interactionReply.js
    // for why this matters (a failed reply() after 소유권가져오기's ownership
    // transfer already saved used to look like it failed while it hadn't).
    await interaction.deferReply({ ephemeral: true });

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return replyEphemeral(interaction, { content: "먼저 음성 채널에 입장해주세요." });
    }

    const tracked = await TempVoiceChannel.findOne({ channelId: voiceChannel.id });
    if (!tracked) {
      return replyEphemeral(interaction, { content: "보이스마스터로 생성된 채널에서만 사용할 수 있습니다." });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "소유권가져오기") {
      if (voiceChannel.members.has(tracked.ownerId)) {
        return replyEphemeral(interaction, { content: "현재 방장이 채널에 있어서 소유권을 가져올 수 없습니다." });
      }
      const { grantOwnerRole, revokeOwnerRole } = require("../voicemaster/voiceStateHandler");
      await revokeOwnerRole(interaction.guild, tracked.ownerId, tracked.ownerRoleId);
      tracked.ownerId = interaction.user.id;
      await tracked.save();
      await grantOwnerRole(interaction.guild, interaction.user.id, tracked.ownerRoleId);
      return replyPublic(interaction, { content: `<@${interaction.user.id}> 님이 새로운 방장이 되었습니다. 👑` });
    }

    if (interaction.user.id !== tracked.ownerId) {
      return replyEphemeral(interaction, { content: "채널 방장만 사용할 수 있어요." });
    }

    if (sub === "이름") {
      const name = interaction.options.getString("이름").slice(0, 90);
      await voiceChannel.setName(name);
      return replyEphemeral(interaction, { content: `채널 이름을 "${name}"(으)로 변경했습니다.` });
    }

    if (sub === "인원제한") {
      const limit = interaction.options.getInteger("인원");
      await voiceChannel.setUserLimit(limit);
      return replyEphemeral(interaction, { content: `인원 제한을 ${limit === 0 ? "무제한" : `${limit}명`}(으)로 변경했습니다.` });
    }

    if (sub === "잠금" || sub === "잠금해제") {
      const everyone = interaction.guild.roles.everyone;
      await voiceChannel.permissionOverwrites.edit(everyone, { Connect: sub === "잠금해제" ? null : false });
      return replyEphemeral(interaction, { content: sub === "잠금" ? "채널을 잠갔습니다. 🔒" : "채널을 열었습니다. 🔓" });
    }

    if (sub === "숨기기" || sub === "보이기") {
      const everyone = interaction.guild.roles.everyone;
      await voiceChannel.permissionOverwrites.edit(everyone, { ViewChannel: sub === "보이기" ? null : false });
      return replyEphemeral(interaction, { content: sub === "숨기기" ? "채널을 숨겼습니다. 🙈" : "채널을 다시 보이게 했습니다. 👀" });
    }

    if (sub === "지역") {
      const region = interaction.options.getString("지역");
      await voiceChannel.setRTCRegion(region === "automatic" ? null : region);
      return replyEphemeral(interaction, { content: `음성 지역을 ${region === "automatic" ? "자동" : region}(으)로 변경했습니다.` });
    }

    if (sub === "비트레이트") {
      const kbps = interaction.options.getInteger("kbps");
      try {
        await voiceChannel.setBitrate(kbps * 1000);
        return replyEphemeral(interaction, { content: `비트레이트를 ${kbps}kbps로 변경했습니다.` });
      } catch (err) {
        console.error(err);
        return replyEphemeral(interaction, { content: "비트레이트를 변경하지 못했습니다. 서버 부스트 등급이 부족할 수 있어요." });
      }
    }
  },
};
