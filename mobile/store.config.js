const fs = require('node:fs');
const path = require('node:path');

module.exports = () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'store.config.json'), 'utf8'));
  const localPath = path.join(__dirname, 'store.local.json');
  if (fs.existsSync(localPath)) {
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    if (local.review) config.apple.review = {
      ...local.review,
      demoRequired: false,
      notes: fs.readFileSync(path.join(__dirname, 'store-review-notes.txt'), 'utf8'),
    };
  }
  return config;
};
