# Simple Discord Bot

![Github commit count](https://img.shields.io/github/commit-activity/m/misterjaykay/simple-discord-bot)
![GitHub last commit](https://img.shields.io/github/last-commit/misterjaykay/simple-discord-bot)

---

## Description
> Simple discord bot for little community needs. Runs entirely on slash commands.

Requires **Node.js 22.12+** (needed by `@discordjs/voice`).

---

## Getting Started

### Install
```
npm install
```

### Configure
Copy `.env.example` to `.env` and fill in your own values (bot token, client ID,
optional guild ID for instant command deploys during development, MongoDB URI, and
a Riot API key if you want `/티어` to work).

### Deploy slash commands
Whenever you add/change a command, push the updated command list to Discord:
```
npm run deploy-commands
```

### Run
```
npm start        # production
npm run dev       # auto-restart on file changes (nodemon)
```

### Hosting
See [DEPLOY.md](./DEPLOY.md) for deploying to Railway (`railway.json` is already set
up for it) - plus a `pm2` + VM alternative if you'd rather self-host for free.

---

## Features

- **Slash commands** for everything - see `/help` in Discord for the full list.
- **Voicemaster** (join-to-create voice channels): admins run `/보이스설정 생성`
  (or `채널지정` to reuse an existing channel) - repeatable, so a guild can have
  several independent trigger channels, each with its own name template
  (`{user}` placeholder) and an optional auto-granted "owner" role. Anyone who
  joins a trigger channel gets their own personal voice channel automatically,
  with a control panel (lock/unlock, hide/reveal, rename, user limit, region,
  bitrate, kick, claim) posted right in the channel's chat, or via `/보이스채널`.
  `/보이스설정 목록` lists every trigger configured for the server.
- **Music playback** (`/재생`, `/스톱`) via `@discordjs/voice`.
- **Points + predictions** (Twitch-style betting): everyone starts with 1000
  points automatically (first time they check `/포인트` or place a bet), and
  admins can hand out more anytime with `/포인트관리 지급` or `/포인트관리 전체지급`.
  Admins run `/예측 생성`, which posts a message with a button per outcome;
  clicking one opens a modal to enter a bet amount. Odds are pari-mutuel (real
  sports-book style, not a flat 2x): the payout multiplier for each option is
  shown live on the message and in the bet modal as `totalPot / optionPot`, so
  it drops as a side gets more action and rises on the side fewer people back.
  `/예측 생성`'s optional `시간` option (minutes) auto-locks the prediction once
  the deadline passes - same effect as running `/예측 마감` manually, and the
  countdown shows live on the message via Discord's auto-updating timestamp.
  Auto-lock timers survive bot restarts (re-armed from the DB on startup). An
  optional `채널` option lets admins post the prediction to a different text
  channel than the one they ran the command in.
  `/예측 마감` stops new bets, `/예측 종료 승리옵션:` settles it - winners split
  the losing side's pot proportionally to their stake, and `/예측 취소` refunds
  everyone if needed.
- **Birthdays / MBTI / movie polls / secret-santa (마니또)** commands backed by
  MongoDB (`MONGODB_URI` must be set for these to work).

---

## Contribute

Please fork this repository.

---

## Questions

### Github Repository
https://github.com/misterjaykay

### E-mail
Please Email at misterjaykay@gmail.com

---

## Licenses
None
