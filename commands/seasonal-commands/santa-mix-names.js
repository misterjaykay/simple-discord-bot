const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../models");

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  deprecated: true, // Old seasonal (Secret Santa) command, unused for now — hidden from command loading.
  data: new SlashCommandBuilder()
    .setName("마니또시작")
    .setDescription("마니또 상대를 섞습니다. (한 번만 사용하세요, 관리자 전용)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const people = await db.Person.find({});
      if (people.length < 2) {
        return interaction.editReply("참가자가 2명 이상이어야 마니또를 시작할 수 있습니다.");
      }

      // Shuffle then pair each person with the next one in the circle - this
      // guarantees nobody is assigned to themselves (the old random-pick-and-remove
      // logic could still end up doing that on the last remaining participant).
      const shuffled = shuffle(people);
      await Promise.all(
        shuffled.map((person, i) => {
          const santa = shuffled[(i + 1) % shuffled.length];
          return db.Person.updateOne({ userId: person.userId }, { $set: { santaId: santa.userId } });
        })
      );

      return interaction.editReply(`${people.length}명의 마니또 상대가 배정되었습니다!`);
    } catch (err) {
      console.error(err);
      return interaction.editReply("마니또를 섞는 중 오류가 발생했습니다.");
    }
  },
};
