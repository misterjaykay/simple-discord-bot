const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

// yt-search would occasionally crash the whole process when YouTube's search
// page format didn't match what it expected (unmaintained package). yt-dlp's
// own "ytsearch1:" pseudo-URL does the same job and gets patched quickly
// whenever YouTube changes something, so search now goes through the same
// tool as playback instead of a second, more fragile dependency.
async function searchYoutube(query) {
  const { stdout } = await execFileAsync("yt-dlp", [`ytsearch1:${query}`, "--dump-json", "--no-playlist", "--quiet", "--no-warnings"], {
    maxBuffer: 10 * 1024 * 1024,
  });

  const line = stdout.trim().split("\n")[0];
  if (!line) return null;

  const data = JSON.parse(line);
  return { url: data.webpage_url || data.original_url, title: data.title };
}

module.exports = { searchYoutube };
