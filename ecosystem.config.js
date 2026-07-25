// pm2 process definition. On the server:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (then run the command it prints, once, so pm2 survives reboots)
module.exports = {
  apps: [
    {
      name: "simple-discord-bot",
      script: "index.js",
      cwd: __dirname,
      watch: false, // keep false in production - a crash-restart loop from watch + logging is confusing
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
