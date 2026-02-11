const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readFromStorage(key) {
  const filePath = path.join(DATA_DIR, key);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeToStorage(key, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, key);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readFromStorage, writeToStorage };
