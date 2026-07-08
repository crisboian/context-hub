// Engram notification hook
async function notifyEngram(entry) {
  // Engram FTS-based, no API endpoint yet
  // This hook exists for future Engram integration
  // For now, log to console
  console.log(`[engram] Would index: entry #${entry.id} (${entry.type})`);
}

module.exports = { notifyEngram };
