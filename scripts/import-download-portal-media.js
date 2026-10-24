'use strict';

// One-time import of image assets from the supplied HTML. Never execute its scripts.
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Supply the reference HTML file');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'app/public/article_static/download_portal/media');
  const $ = cheerio.load(await fs.readFile(input, 'utf8'));
  const base = $('base').attr('href');
  const urls = Array.from(new Set($('img[src]').map((i, el) => {
    try { return new URL($(el).attr('src'), base).href; } catch (_) { return ''; }
  }).get().filter(url => /^https?:\/\//.test(url))));
  await fs.ensureDir(output);
  let index = 0;
  const result = new Array(urls.length);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < urls.length) {
      const position = index++;
      const source = urls[position];
      const filename = crypto.createHash('sha256').update(source).digest('hex').slice(0, 20) + path.extname(new URL(source).pathname).toLowerCase();
      const target = path.join(output, filename);
      try {
        if (!await fs.pathExists(target)) {
          const response = await axios.get(source, { responseType: 'arraybuffer', timeout: 12000, maxRedirects: 3, maxContentLength: 6 * 1024 * 1024 });
          const buffer = Buffer.from(response.data);
          const signature = buffer.slice(0, 12).toString('hex');
          if (!/^(ffd8ff|89504e47|47494638|52494646)/.test(signature)) throw new Error('Unsupported image content');
          await fs.writeFile(target, buffer);
        }
        result[position] = { source, url: '/article_static/download_portal/media/' + filename, local: true };
      } catch (error) {
        if (position < 3) console.log('Image request failed: ' + String(error.code || error.message));
        result[position] = { source, url: '/article_static/download_portal/fallback.svg', local: false };
      }
      if ((position + 1) % 50 === 0) console.log('Processed ' + (position + 1) + '/' + urls.length);
    }
  }));
  await fs.writeJson(path.join(root, 'app/common_data/Article/download_portal_media.json'), result, { spaces: 2 });
  console.log(JSON.stringify({ images: result.length, downloaded: result.filter(item => item.local).length, fallback: result.filter(item => !item.local).length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
