// Groups the 18 PokeAPI types into 5 speaking styles for ambient pet chatter
// (see pet/petChatterService.js) - same "bucket by type instead of authoring
// per-species" trick as petService.JOB_POOL, just fewer buckets since tone
// doesn't need to be as granular as job flavor. First matching type on the
// pet wins; a pet with no recognized type (shouldn't happen once
// ensureBattleStats has run) falls back to "cute".
const PERSONALITY_BY_TYPE = {
  fire: "hotblooded", fighting: "hotblooded", dragon: "hotblooded", dark: "hotblooded",
  water: "elegant", ice: "elegant", psychic: "elegant", fairy: "elegant",
  ghost: "playful", poison: "playful", steel: "playful",
  normal: "cute", grass: "cute", bug: "cute", electric: "cute",
  rock: "gruff", ground: "gruff", flying: "gruff",
};

const PERSONALITIES = ["hotblooded", "elegant", "playful", "cute", "gruff"];

function personalityFor(pet) {
  for (const t of pet.types ?? []) {
    const group = PERSONALITY_BY_TYPE[t];
    if (group) return group;
  }
  return "cute";
}

function pickLine(pool, personality) {
  const lines = pool[personality] ?? pool.cute;
  return lines[Math.floor(Math.random() * lines.length)];
}

// Each category maps every personality to a small pool of lines - 2-3 each is
// enough to avoid feeling like a broken record without a huge writing lift.
// Expand these over time; nothing else needs to change to add more variety.
const DIALOGUE = {
  dispatchReturn: {
    hotblooded: ["다녀왔어! 이 정도쯤이야 식은 죽 먹기였지.", "일 좀 하고 왔더니 몸이 근질거리네. 대전이라도 나갈까?"],
    elegant: ["다녀왔어... 오늘도 무사히 마쳤네.", "돌아왔어. 잘 지냈어?"],
    playful: ["짠, 나 왔지롱! 보고 싶었어?", "다녀왔어~ 선물은 없지만 재밌는 이야기는 있어."],
    cute: ["다녀왔어! 열심히 일하고 왔다구, 칭찬해줘!", "주인아 나 왔어! 오늘 진짜 열심히 했어!"],
    gruff: ["...왔다.", "다녀왔다. 별일 없었지."],
  },
  neglect: {
    hotblooded: ["야, 밥은 주고 살아야 할 거 아냐!", "이봐, 나 굶고 있잖아. 잊은 거 아니지?"],
    elegant: ["...배가 좀 고픈 것 같은데, 신경 써줄 수 있어?", "요즘 얼굴 보기가 힘드네."],
    playful: ["킥킥... 배고파 죽겠는데 안 챙겨주네, 서운하다?", "나 여기서 굶어 죽는 거 보고 싶은 거야?"],
    cute: ["주인아... 나 배고파.", "나 좀 챙겨줘... 심심하기도 하고 배고프기도 해."],
    gruff: ["...밥.", "배고프다. 그게 다야."],
  },
  albaNeglect: {
    hotblooded: ["일 안 시켜? 몸이 근질거리는데.", "이대로 놀고만 있을 순 없지, 알바 좀 보내줘."],
    elegant: ["요즘 일이 없네... 심심해서 못 살겠어.", "슬슬 다시 일하고 싶은데."],
    playful: ["킥킥, 알바 안 보내주면 나 몰래 놀러 나갈지도?", "심심해서 장난이라도 쳐야겠어."],
    cute: ["나도 일하고 싶어! 알바 보내줘!", "요즘 알바 안 시켜줘서 심심해..."],
    gruff: ["...일이 없다. 심심하다.", "할 일을 달라."],
  },
  evolutionNear: {
    hotblooded: ["이 정도 힘으론 부족해... 조금만 더 크면 진짜 실력을 보여주지.", "몸이 뜨거워지는 게 느껴져. 얼마 안 남았어."],
    elegant: ["몸이 조금씩 달라지는 게 느껴져... 곧 새로운 모습을 보여줄 수 있을 것 같아.", "때가 가까워지고 있는 것 같아."],
    playful: ["쉿, 비밀인데... 나 곧 완전히 달라질지도 몰라.", "궁금하지 않아? 나도 궁금해."],
    cute: ["나 조금만 더 크면 새로운 모습 보여줄 수 있을 것 같아! 기대해줘!", "곧 있으면 나 더 멋있어질지도 몰라!"],
    gruff: ["...몸이 근질거려. 얼마 안 남은 것 같다.", "곧이다."],
  },
  evolutionReady: {
    hotblooded: ["이제 준비 끝났어. 진화시켜줘!", "더는 못 참겠어, 지금 당장 진화하고 싶어!"],
    elegant: ["때가 온 것 같아... 준비됐어.", "이제 다음 단계로 갈 때가 된 것 같아."],
    playful: ["나 지금 진화할 수 있는 거 알아? 궁금하지 않아?", "슬슬 변신할 시간이야, 후후."],
    cute: ["나 진화할 수 있대! 얼른 시켜줘!", "드디어 때가 왔어! 나 진화시켜줘!"],
    gruff: ["...때가 왔다.", "진화. 준비됐다."],
  },
  birthday: {
    hotblooded: ["오늘 주인 생일이라며! 오늘만큼은 특별히 봐준다.", "생일 축하해! 오늘은 특별히 봐줄게."],
    elegant: ["오늘 주인 생일이래... 축하해.", "생일 축하해. 좋은 하루 보내길 바라."],
    playful: ["오늘 주인 생일이래... 축하해, 케이크는 내가 대신 먹어줄게.", "생일 축하해! 선물은... 마음만 받아줘 킥킥."],
    cute: ["주인아 생일 축하해! 오늘은 내가 더 애교 부려줄게!", "오늘 특별한 날이라며! 축하해!"],
    gruff: ["...생일이라고 들었다. 축하한다.", "축하한다. 그뿐이다."],
  },
  tournamentWinner: {
    hotblooded: ["해냈다! 역시 나야! 이번 주 우승은 내 거였어!", "너무 기뻐! 이 기세로 다음 주도 우승할 거야!"],
    elegant: ["우승이라니... 믿기지 않아. 정말 기뻐.", "노력한 보람이 있었네. 너무 행복해."],
    playful: ["우승했다구! 다들 나한테 존댓말 써야 하는 거 아냐? 킥킥.", "짜잔, 이번 주 챔피언은 바로 나!"],
    cute: ["나 우승했어!! 너무너무 기뻐!!", "주인아 나 우승했어! 진짜 진짜 행복해!"],
    gruff: ["...우승했다. 나쁘지 않군.", "이겼다. 그게 다다."],
  },
  tournamentRunnerUp: {
    hotblooded: ["아깝다... 다음 주는 진짜 우승할 거야, 두고 봐!", "이번엔 졌지만 다음엔 안 봐줘."],
    elegant: ["아쉽네... 다음 주엔 꼭 우승해볼게.", "아쉬운 결과지만, 다음을 기약해야지."],
    playful: ["에이, 딱 한 끗 차이였는데! 다음 주는 진짜야.", "준우승도 나쁘지 않지만... 다음엔 우승하고 말겠어."],
    cute: ["아쉬워... 근데 다음 주는 꼭 우승하자!", "이번엔 2등이었지만 다음엔 1등 할 거야!"],
    gruff: ["...아깝군. 다음엔 이긴다.", "졌다. 다음엔 안 진다."],
  },
  tournamentPastChamp: {
    hotblooded: ["그때 우승했던 실력, 아직 안 죽었어. 이번 주도 노려볼까.", "예전 실력 다시 보여줘야겠어. 훈련 좀 더 하자."],
    elegant: ["예전 그 트로피가 그립네... 좀 더 다듬어서 다시 도전해볼까.", "다시 한번 그 자리에 서고 싶어."],
    playful: ["옛날 생각나네 킥킥, 슬슬 몸 좀 풀어볼까?", "다시 우승 트로피 노려볼까? 재밌겠는데."],
    cute: ["그때 우승 트로피 아직도 생생한데... 좀 더 훈련해서 이번 주도 노려볼까.", "나 예전에 우승한 적 있잖아! 다시 도전하고 싶어!"],
    gruff: ["...예전에 이겼었다. 다시 해볼까.", "훈련이 더 필요하다."],
  },
  voiceGreet: {
    hotblooded: ["어! 왔네, 오늘도 신나게 놀아보자!", "왔구나! 기다렸어!"],
    elegant: ["어서 와... 기다리고 있었어.", "왔네. 반가워."],
    playful: ["짠, 왔지롱! 반가워!", "어? 왔어? 반가워 킥킥."],
    cute: ["어? 왔어? 반가워!", "주인아 왔구나! 반가워!"],
    gruff: ["...왔냐.", "왔군."],
  },
};

module.exports = { PERSONALITIES, personalityFor, pickLine, DIALOGUE };
