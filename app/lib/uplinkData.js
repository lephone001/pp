'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../public/html');

// 直接使用现有 html 目录；只初始化缺失数据，不再依赖种子目录。
function ensure(directory = root) {
  fs.mkdirSync(directory, { recursive: true });
  const initial = {
    'app.json': '[]', 'bc.json': '[]',
    'testurl.js': 'window.AppList = []; window.TIMEUPDATE = "";\n',
    'bc-testurl.js': 'window.AppList = []; window.TIMEUPDATE = "";\n',
  };
  for (const name of Object.keys(initial)) {
    try { fs.writeFileSync(path.join(directory, name), initial[name], { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
}
module.exports = { ensure, root };
