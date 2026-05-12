const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(
  __dirname,
  'analysis_history.json',
);

const readHistory = () => {
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeHistory = (history) => {
  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(history, null, 2),
  );
};

const addEntry = (
  sessionId,
  imageCount,
  imagePaths,
  result,
) => {
  const history = readHistory();

  const entry = {
    id: sessionId,
    timestamp: new Date().toISOString(),
    imageCount,
    imagePaths,
    plant_name:
      result.plant_identification?.common_name || 'Unknown',
    health_status: result.health_status,
    overall_health_score: result.overall_health_score,
    result,
  };

  history.unshift(entry);

  // keep last 50 histories
  const trimmed = history.slice(0, 50);
  writeHistory(trimmed);

  return entry;
};

const getHistory = () => {
  return readHistory();
};

const getEntryById = (id) => {
  const history = readHistory();
  return history.find((entry) => entry.id === id) || null;
};

const clearHistory = () => {
  writeHistory([]);
};

module.exports = {
  addEntry,
  getHistory,
  getEntryById,
  clearHistory,
};
