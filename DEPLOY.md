# 배포 가이드 (Railway)

`railway.json`이 이미 준비되어 있어서(`node index.js`로 시작, 실패 시 자동 재시작),
Railway에서는 리포지토리를 연결하기만 하면 됩니다. Heroku 때처럼 Procfile 기반으로
동작하지만 pm2 같은 별도 프로세스 매니저는 필요 없습니다 (Railway가 대신 관리).

## 1. GitHub 연동으로 배포 (권장)

1. https://railway.app 가입 (카드 등록 없이 시작 가능, 가입 시 $5 크레딧 지급)
2. **New Project > Deploy from GitHub repo** 선택 후 `simple-discord-bot` 리포지토리 선택
   - GitHub 계정이 아직 연결 안 되어 있으면 그 자리에서 연결하라고 안내됩니다.
3. 배포되면 서비스 클릭 > **Variables** 탭에서 환경변수 등록:
   - `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`(선택), `MONGODB_URI`, `RIOT_API_KEY`(선택)
4. **Settings** 탭에서 Node 버전이 22 이상으로 잡히는지 확인 (`package.json`의 `engines.node`를 Nixpacks가 자동으로 읽습니다)
5. 이 프로젝트는 계속 떠 있는 백그라운드 프로세스라 **공개 도메인(Networking > Generate Domain)은 필요 없습니다** - 생성하지 않아도 됩니다.
6. 슬래시 커맨드를 처음 등록하거나 커맨드를 바꿨을 때는 로컬에서 한 번 실행:
   ```
   npm run deploy-commands
   ```
   (Railway 서비스 자체는 실행할 필요 없이, `.env`에 같은 값 넣고 로컬 PC에서 돌리면 됩니다.)

이후로는 `git push`만 하면 Railway가 자동으로 재배포합니다.

## 2. CLI로 배포하고 싶다면

```bash
npm install -g @railway/cli
railway login
cd simple-discord-bot
railway init
railway up
```

환경변수는 `railway variables --set BOT_TOKEN=...` 식으로 넣거나, 대시보드 Variables 탭에서 넣으면 됩니다.

## 3. 크레딧 관련 참고

가입 시 받는 $5는 매달 리필되는 방식이 아니라 트라이얼 성격이라, 다 쓰면 카드를 등록하고 소액 결제($5/월 내외)로 계속 쓰게 됩니다. 이 봇처럼 가벼운 Node 프로세스면 대부분 그 안에서 해결됩니다. 사용량은 대시보드의 **Usage** 탭에서 확인할 수 있어요.

## MongoDB

봇 호스팅과 별개로 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) M0 티어(512MB, 영구 무료)를 추천합니다. 연결 문자열을 Railway Variables의 `MONGODB_URI`에 넣으면 됩니다.

---

## 참고: pm2 + 직접 서버(Oracle Cloud 등) 방식

Railway 크레딧을 다 쓰거나 완전히 서버 비용 없이 가고 싶다면, `ecosystem.config.js`가
pm2용으로 이미 준비되어 있습니다. 직접 VM(Oracle Cloud Always Free 등)을 띄운 뒤:

```bash
git clone https://github.com/misterjaykay/simple-discord-bot.git
cd simple-discord-bot
npm install
cp .env.example .env   # 값 채우기
npm run deploy-commands
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # 출력되는 명령어를 한 번 실행 -> 재부팅 후에도 자동 시작
```
