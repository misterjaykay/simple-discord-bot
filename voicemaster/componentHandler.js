const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require("discord.js");
const TempVoiceChannel = require("../models/temp-voice-channel");
const { grantOwnerRole, revokeOwnerRole } = require("./voiceStateHandler");

async function getTrackedChannel(interaction) {
  const tracked = await TempVoiceChannel.findOne({ channelId: interaction.channel.id });
  if (!tracked) {
    await interaction.reply({ content: "이 채널은 보이스마스터로 생성된 채널이 아닙니다.", ephemeral: true });
    return null;
  }
  return tracked;
}

function requireOwner(interaction, tracked) {
  if (interaction.user.id !== tracked.ownerId) {
    interaction.reply({ content: "채널 방장만 사용할 수 있어요.", ephemeral: true });
    return false;
  }
  return true;
}

async function handleVoicemasterComponent(interaction) {
  const { customId } = interaction;

  if (customId === "vm:toggle_lock") {
    const tracked = await getTrackedChannel(interaction);
    if (!tracked || !requireOwner(interaction, tracked)) return;

    const voiceChannel = interaction.channel;
    const everyone = interaction.guild.roles.everyone;
    const currentlyLocked = voiceChannel.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;

    await voiceChannel.permissionOverwrites.edit(everyone, { Connect: currentlyLocked ? null : false });
    return interaction.reply({ content: currentlyLocked ? "채널을 열었습니다. 🔓" : "채널을 잠갔습니다. 🔒", ephemeral: true });
  }

  if (customId === "vm:claim") {
    const tracked = await getTrackedChannel(interaction);
    if (!tracked) return;

    const voiceChannel = interaction.channel;
    if (voiceChannel.members.has(tracked.ownerId)) {
      return interaction.reply({ content: "현재 방장이 채널에 있어서 소유권을 가져올 수 없습니다.", ephemeral: true });
    }

    await revokeOwnerRole(interaction.guild, tracked.ownerId, tracked.ownerRoleId);
    tracked.ownerId = interaction.user.id;
    await tracked.save();
    await grantOwnerRole(interaction.guild, interaction.user.id, tracked.ownerRoleId);

    return interaction.reply(`<@${interaction.user.id}> 님이 새로운 방장이 되었습니다. 👑`);
  }

  if (customId === "vm:settings") {
    const tracked = await getTrackedChannel(interaction);
    if (!tracked || !requireOwner(interaction, tracked)) return;

    const modal = new ModalBuilder().setCustomId("vm:settings_modal").setTitle("채널 설정");
    const nameInput = new TextInputBuilder()
      .setCustomId("vm:name")
      .setLabel("채널 이름")
      .setStyle(TextInputStyle.Short)
      .setValue(interaction.channel.name)
      .setMaxLength(90)
      .setRequired(false);
    const limitInput = new TextInputBuilder()
      .setCustomId("vm:limit")
      .setLabel("인원 제한 (0 = 무제한)")
      .setStyle(TextInputStyle.Short)
      .setValue(String(interaction.channel.userLimit ?? 0))
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(limitInput));
    return interaction.showModal(modal);
  }

  if (customId === "vm:settings_modal") {
    const tracked = await getTrackedChannel(interaction);
    if (!tracked || !requireOwner(interaction, tracked)) return;

    const name = interaction.fields.getTextInputValue("vm:name");
    const limitRaw = interaction.fields.getTextInputValue("vm:limit");
    const limit = Number.parseInt(limitRaw, 10);

    const updates = {};
    if (name) updates.name = name.slice(0, 90);
    if (!Number.isNaN(limit) && limit >= 0 && limit <= 99) updates.userLimit = limit;

    await interaction.channel.edit(updates).catch((err) => console.error("[voicemaster] settings modal edit failed:", err));
    return interaction.reply({ content: "채널 설정을 업데이트했습니다.", ephemeral: true });
  }

  if (customId === "vm:kick_select") {
    const tracked = await getTrackedChannel(interaction);
    if (!tracked || !requireOwner(interaction, tracked)) return;

    const targetId = interaction.values[0];
    const member = interaction.guild.members.cache.get(targetId) ?? (await interaction.guild.members.fetch(targetId).catch(() => null));

    if (!member || member.voice.channelId !== interaction.channel.id) {
      return interaction.reply({ content: "해당 유저는 이 채널에 없습니다.", ephemeral: true });
    }

    await member.voice.disconnect().catch((err) => console.error("[voicemaster] kick failed:", err));
    return interaction.reply({ content: `<@${targetId}> 님을 추방했습니다.`, ephemeral: true });
  }
}

module.exports = { handleVoicemasterComponent };
