'use strict';

const fs = require('fs');
const path = require('path');

function templateHtmlRedirectPath(requestPath, baseDir) {
  const rawPath = String(requestPath || '');
  const match = /^\/([A-Za-z0-9_-]+)\/(.+\.html?)$/i.exec(rawPath);
  if (!match) return null;

  let relativePath;
  try {
    relativePath = decodeURIComponent(match[2]);
  } catch (error) {
    return null;
  }
  if (relativePath.includes('\\') || relativePath.split('/').some(part => part === '.' || part === '..' || !part)) {
    return null;
  }

  const templateDir = path.resolve(baseDir, 'app/view/template', match[1]);
  const file = path.resolve(templateDir, relativePath);
  const relative = path.relative(templateDir, file);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return null;

  try {
    if (!fs.statSync(file).isFile()) return null;
  } catch (error) {
    return null;
  }
  return '/' + match[2];
}

module.exports = { templateHtmlRedirectPath };
