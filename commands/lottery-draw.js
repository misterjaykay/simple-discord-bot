// Superseded by commands/lottery.js ("/복권 추첨 ..." subcommand group), which
// merges this together with the instant lottery under one /복권 parent
// command now that it's launched (no longer hidden). Kept as a deprecated
// stub (rather than deleted) since this environment has no file-delete
// capability - the loader in index.js and deploy-commands.js both skip any
// command with `deprecated: true`.
module.exports = { deprecated: true };
