const fs = require('fs');

const cache = new Map();
const TTL = 5 * 60 * 1000; // 5分钟

function isDevelopmentEnv() {
  const nodeEnv = process.env.NODE_ENV;
  const eggEnv = process.env.EGG_SERVER_ENV;
  return nodeEnv === 'development' || eggEnv === 'local' || eggEnv === 'development';
}

function getCacheValue(key) {
  if (isDevelopmentEnv()) return undefined;

  const now = Date.now();
  const item = cache.get(key);
  if (item && item.expireAt > now) {
    return item.value;
  }
  return undefined;
}

function setCacheValue(key, value) {
  if (isDevelopmentEnv()) return value;

  cache.set(key, {
    value,
    expireAt: Date.now() + TTL,
  });
  return value;
}

function templateExists(key, filepath) {
  if (isDevelopmentEnv()) return fs.existsSync(filepath);

  const cacheKey = `exists:${key}`;
  const cached = getCacheValue(cacheKey);
  if (cached !== undefined) return cached;

  const exists = fs.existsSync(filepath);
  return setCacheValue(cacheKey, exists);
}

function resolveTemplate(key, filepath, templateName, fallbackName) {
  if (isDevelopmentEnv()) return fs.existsSync(filepath) ? templateName : fallbackName;

  const cacheKey = `template:${key}`;
  const cached = getCacheValue(cacheKey);
  if (cached !== undefined) return cached;

  const finalTemplate = fs.existsSync(filepath) ? templateName : fallbackName;
  return setCacheValue(cacheKey, finalTemplate);
}

function clearTemplateExistsCache(key) {
  if (key) {
    cache.delete(`exists:${key}`);
    cache.delete(`template:${key}`);
  } else {
    cache.clear();
  }
}

module.exports = {
  templateExists,
  resolveTemplate,
  clearTemplateExistsCache,
};
