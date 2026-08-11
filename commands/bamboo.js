const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

// sub(한글 커맨드) -> internal category stored on BambooPost + used to route
// the modal submit in bamboo/componentHandler.js.
const CATEGORY_BY_SUB = {
  신고: "report",
  건의: "suggestion",
  불만: "complaint",
  고민: "concern",
};

const MODAL_LABEL_BY_CATEGORY = {
  report: "신고 사유",
  suggestion: "건의 내용",
  complaint: "불만 내용",
  concern: "고민 내용",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("대나무숲")
    .setDescription("운영진에게만 전달되는 제보함입니다. 누가 보냈는지는 기록되지만 다른 멤버에게는 절대 공개되지 않습니다.")
    .addSubcommand((sub) =>
      sub
        .setName("신고")
        .setDescription("VC/서버에서 있었던 일을 운영진에게만 신고합니다.")
        .addUserOption((opt) => opt.setName("유저").setDescription("신고 대상").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("건의").setDescription("운영진에게만 건의사항을 전달합니다."))
    .addSubcommand((sub) => sub.setName("불만").setDescription("운영진에게만 불만사항을 전달합니다."))
    .addSubcommand((sub) => sub.setName("고민").setDescription("운영진에게만 고민을 전달합니다.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const category = CATEGORY_BY_SUB[sub];

    let customId = `bamboo:submit:${category}`;

    if (category === "report") {
      const target = interaction.options.getUser("유저");
      if (target.bot) {
        return interaction.reply({ content: "봇은 신고 대상이 될 수 없어요.", ephemeral: true });
      }
      if (target.id === interaction.user.id) {
        return interaction.reply({ content: "본인을 신고할 수는 없어요.", ephemeral: true });
      }
      customId += `:${target.id}`;
    }

    const modal = new ModalBuilder().setCustomId(customId).setTitle(`대나무숲 - ${sub}`);
    const contentInput = new TextInputBuilder()
      .setCustomId("content")
      .setLabel(MODAL_LABEL_BY_CATEGORY[category])
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
    return interaction.showModal(modal);
  },
};
