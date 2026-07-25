const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } = require("discord.js");
const VoiceMasterConfig = require("../models/voicemaster-config");
const TempVoiceChannel = require("../models/temp-voice-channel");

function buildControlPanel(channel, owner) {
  const embed = new EmbedBuilder()
    .setTitle(`🔊 ${channel.name}`)
    .setDescription(`이 채널의 방장은 <@${owner.id}> 님입니다.\n아래 버튼으로 채널을 관리할 수 있어요. (\`/보이스채널\` 명령어로도 동일하게 관리할 수 있습니다)`)
    .setColor(0x5865f2);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("vm:toggle_lock").setLabel("잠그기 / 열기").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("vm:settings").setLabel("이름 / 인원 설정").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("vm:claim").setLabel("소유권 가져오기").setEmoji("👑").setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId("vm:kick_select").setPlaceholder("추방할 멤버 선택").setMinValues(1).setMaxValues(1)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function applyNameTemplate(template, member) {
  return (template || "{user}의 채널").replaceAll("{user}", member.displayName).slice(0, 90);
}

async function grantOwnerRole(guild, userId, roleId) {
  if (!roleId) return;
  const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
  if (!member) return;
  await member.roles.add(roleId).catch((err) => console.error("[voicemaster] failed to grant owner role:", err));
}

async function revokeOwnerRole(guild, userId, roleId) {
  if (!roleId) return;
  const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
  if (!member) return;
  await member.roles.remove(roleId).catch((err) => console.error("[voicemaster] failed to revoke owner role:", err));
}

async function handleVoiceStateUpdate(oldState, newState) {
  try {
    const guild = newState.guild ?? oldState.guild;

    // 1) Someone joined a configured "join to create" trigger channel -> spin up
    //    a brand new personal voice channel for them and move them into it.
    //    Looking the config up by the exact channel joined (rather than "the
    //    guild's one config") is what lets a guild run several independent
    //    trigger channels at once.
    if (newState.channelId) {
      const config = await VoiceMasterConfig.findOne({ triggerChannelId: newState.channelId });
      if (config) {
        const member = newState.member;
        const parent = config.categoryId ? guild.channels.cache.get(config.categoryId) : newState.channel.parent;

        const tempChannel = await guild.channels.create({
          name: applyNameTemplate(config.nameTemplate, member),
          type: ChannelType.GuildVoice,
          parent: parent ?? undefined,
        });

        await TempVoiceChannel.create({
          channelId: tempChannel.id,
          guildId: guild.id,
          ownerId: member.id,
          ownerRoleId: config.ownerRoleId ?? undefined,
        });

        await member.voice.setChannel(tempChannel).catch((err) => console.error("[voicemaster] failed to move member:", err));
        await grantOwnerRole(guild, member.id, config.ownerRoleId);

        tempChannel
          .send(buildControlPanel(tempChannel, member.user))
          .catch((err) => console.error("[voicemaster] failed to send control panel:", err));
      }
    }

    // 2) Someone left a tracked temp channel -> delete it once it's empty, and
    //    revoke the owner role from whoever held it.
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const tracked = await TempVoiceChannel.findOne({ channelId: oldState.channelId });
      if (tracked) {
        const emptiedChannel = oldState.channel ?? guild.channels.cache.get(oldState.channelId);
        if (emptiedChannel && emptiedChannel.members.size === 0) {
          await TempVoiceChannel.deleteOne({ channelId: oldState.channelId });
          await revokeOwnerRole(guild, tracked.ownerId, tracked.ownerRoleId);
          await emptiedChannel.delete().catch((err) => console.error("[voicemaster] failed to delete empty temp channel:", err));
        }
      }
    }
  } catch (err) {
    console.error("[voicemaster] voiceStateUpdate error:", err);
  }
}

module.exports = { handleVoiceStateUpdate, buildControlPanel, grantOwnerRole, revokeOwnerRole };
