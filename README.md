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
