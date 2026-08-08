const Player = require("../models/player");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function byNickname(nickname) {
  return Player.findOne({ name: new RegExp(`^${escapeRegex(nickname)}$`, "i") });
}

async function linkPlayer(nickname, discordUserId) {
  const player = await byNickname(nickname);
  if (!player) throw new Error(`"${nickname}" 닉네임의 플레이어를 찾을 수 없어요.`);

  const alreadyLinkedElsewhere = await Player.findOne({ discordUserId, _id: { $ne: player._id } });
  if (alreadyLinkedElsewhere) {
    throw new Error(`이 유저는 이미 "${alreadyLinkedElsewhere.name}"에 연동되어 있어요. 먼저 해제(\`/발로연동 해제\`)해주세요.`);
  }

  player.discordUserId = discordUserId;
  await player.save();
  return player;
}

async function unlinkPlayer({ nickname, discordUserId }) {
  const player = nickname ? await byNickname(nickname) : await Player.findOne({ discordUserId });
  if (!player) throw new Error("연동 정보를 찾을 수 없어요.");

  // Explicit $unset rather than `player.discordUserId = undefined; save()` -
  // this is the sparse-unique-indexed field, so we want to be certain it's
  // actually removed from the document rather than left as a stored null
  // (which would collide with every other unlinked player under a unique index).
  await Player.updateOne({ _id: player._id }, { $unset: { discordUserId: 1 } });
  return player;
}

async function listLinks() {
  return Player.find({ discordUserId: { $exists: true, $ne: null } }).lean();
}

module.exports = { linkPlayer, unlinkPlayer, listLinks };
