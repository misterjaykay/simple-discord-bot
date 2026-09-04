const ProcessedInteraction = require("./models/processed-interaction");

// Call as the very first thing in a command handler that has side effects
// worth protecting from double-execution (deducting points, incrementing a
// daily/weekly counter, etc.) - returns true if THIS call is the one that
// should actually process the interaction, false if it's a duplicate
// delivery that something else (this process or another one) already
// claimed, in which case the caller should return immediately without
// touching interaction.reply/deferReply at all.
//
// Implemented as a unique-indexed insert rather than a read-then-check,
// specifically so it stays correct even when two live processes call this
// for the same interaction id at nearly the same moment (see
// models/processed-interaction.js for why that happens) - only one insert
// can ever win a unique index, so there's no read-then-write race window to
// land in like there would be with a find-then-insert-if-missing check.
async function claimInteraction(interaction) {
  try {
    await ProcessedInteraction.create({ interactionId: interaction.id });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

module.exports = { claimInteraction };
