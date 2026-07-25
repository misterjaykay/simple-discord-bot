// Deprecated: this was a debug/test command (name says "생일" but the body has
// nothing to do with birthdays) that started a `setInterval` spamming "돌아가는중"
// every second. Its "OFF" branch called `clearInterval()` with no argument, which
// clears nothing - so once started it could never actually be turned off. Removed
// as unsafe dead code rather than converted.
//
// Safe to delete this file.
module.exports = { deprecated: true };
