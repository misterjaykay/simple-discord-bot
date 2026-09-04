// A random id generated once when this module is first loaded - i.e. once
// per live Node process. Purely a debugging aid: log it alongside anything
// where "was this the same process as last time, or a different one" is the
// question (see index.js's boot log and commands/points/lottery.js's scratch
// logs) - two different ids appearing for events that should be impossible
// to duplicate is definitive proof of two live processes, as opposed to a
// single process somehow double-handling one event.
const crypto = require("crypto");
const INSTANCE_ID = crypto.randomUUID().slice(0, 8);

module.exports = { INSTANCE_ID };
