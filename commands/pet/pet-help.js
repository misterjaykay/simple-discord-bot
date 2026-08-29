const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { ADOPT_COSTS, FEED_COST, PLAY_COST, EVOLVE_COST, MAX_STORAGE } = require("../../pet/petService");
const { GENERATION_GROUPS } = require("../../pet/pokeApiClient");

// Kept as its own command (rather than folding into the generic /help) since
// the pet system has grown into ~15 commands with real interactions between
// them (슬롯 vs 보관함, 활성 펫, 세대별 가격) that a one-line-per-command list
// can't really explain - this groups them by what the player is trying to do.
module.exports = {
  data: new SlashCommandBuilder().setName("펫도움").setDescription("펫 관련 명령어를 종류별로 자세히 설명합니다."),
  async execute(interaction) {
    const adoptCosts = Object.entries(ADOPT_COSTS)
      .map(([gen, cost]) => `${GENERATION_GROUPS[gen].label} ${cost}P`)
      .join(" / ");

    const embed = new EmbedBuilder()
      .setTitle("🐾 펫 명령어 안내")
      .setColor(0xffcb05)
      .addFields(
        {
          name: "🐣 입양 & 정보",
          value:
            `\`/펫입양 세대:번호\` — 포인트로 새 펫 입양 (${adoptCosts}). 마음에 들 때까지 최대 10번 다시뽑기 가능\n` +
            "`/펫정보 [슬롯]` — 펫 상태 확인 (슬롯 생략 시 보유한 펫 전부 표시)\n" +
            "`/펫이름변경 이름 [슬롯]` — 펫 닉네임 변경\n" +
            "`/펫파양 [슬롯]` — 펫 영구 삭제 (되돌릴 수 없어요 - 대신 `/펫보관`도 고려해보세요)",
        },
        {
          name: "🍖 케어 & 성장",
          value:
            `\`/펫밥주기 [슬롯]\` — ${FEED_COST}P, 밥 주기 (쿨다운·하루 횟수 제한 있음)\n` +
            `\`/펫놀아주기 [슬롯]\` — ${PLAY_COST}P, 놀아주기 (쿨다운·하루 횟수 제한 있음)\n` +
            `\`/진화 [슬롯]\` — ${EVOLVE_COST}P, 레벨 조건 충족 시 펫을 진화시켜요`,
        },
        {
          name: "📦 슬롯 & 보관함",
          value:
            "`/펫슬롯` — 슬롯 현황 확인 · 새 슬롯 열기 · 활성 펫 전환\n" +
            "`/펫활성화 슬롯:번호` — 슬롯을 지정하지 않은 명령어가 적용될 \"활성 펫\" 지정\n" +
            `\`/펫보관 [슬롯]\` — 파양 대신 보관함에 넣기 (무료, 최대 ${MAX_STORAGE}마리)\n` +
            "`/펫꺼내기 보관슬롯:번호 [슬롯]` — 보관함의 펫을 활성 슬롯으로 꺼내기\n" +
            "`/펫보관함` — 보관 중인 펫 목록 확인",
        },
        {
          name: "💰 수익 활동",
          value: "`/펫알바 [슬롯]` — 하루 1회, 바로 알바 보내고 포인트 획득\n`/펫파견 기간 [슬롯]` — 며칠간 장기 파견 (시작하면 취소 불가, 확정 포인트)",
        },
        {
          name: "🏆 펫 대전",
          value:
            "`/펫대전 신청` — 이번 주 펫 대전 참가 신청\n" +
            "`/펫대전 확인` — 진행 상황·상금 풀 확인\n" +
            "`/펫대전 시작/종료/채널설정` — (관리자 전용) 대전 주기 관리",
        },
        {
          name: "🔧 관리자 전용",
          value: "`/펫채널설정` — 펫 명령어를 사용할 수 있는 채널 제한",
        }
      )
      .setFooter({ text: "[슬롯]이 선택 사항인 명령어는 펫이 1마리뿐이면 생략해도 되고, 여러 마리면 활성 펫에 적용돼요." });

    return interaction.reply({ embeds: [embed] });
  },
};
