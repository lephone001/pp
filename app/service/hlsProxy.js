'use strict';

const Service = require('egg').Service;
const axios = require('axios');

const MAX_PLAYLIST_SIZE = 4 * 1024 * 1024;
const MAX_SEGMENT_SIZE = 64 * 1024 * 1024;
const REQUEST_TIMEOUT = 20000;

function isPrivateIp(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;

  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127 ||
    parts[0] === 169 && parts[1] === 254;
}

function getExternalUrl(value) {
  if (!value || typeof value !== 'string' || value.length > 4096) return null;

  let target;
  try {
    target = new URL(value);
  } catch (error) {
    return null;
  }

  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
  if (isPrivateIp(target.hostname)) return null;
  return target;
}

function getResponseUrl(response, fallback) {
  return response && response.request && response.request.res && response.request.res.responseUrl || fallback;
}

function isPlaylist(url, body, contentType) {
  const text = Buffer.isBuffer(body) ? body.toString('utf8', 0, 128) : String(body || '');
  return /^\s*#EXTM3U/.test(text) || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType || '') || /\.m3u8(?:[?#]|$)/i.test(url);
}

function proxyUrl(ctx, target) {
  return `${ctx.protocol}://${ctx.host}/hls-proxy?url=${encodeURIComponent(target)}`;
}

function rewriteAttributeUris(line, baseUrl, ctx) {
  return line.replace(/URI=("|')([^"']+)(\1)/gi, (match, quote, uri) => {
    let resolved;
    try {
      resolved = new URL(uri, baseUrl);
    } catch (error) {
      return match;
    }
    if (!['http:', 'https:'].includes(resolved.protocol)) return match;
    return `URI=${quote}${proxyUrl(ctx, resolved.toString())}${quote}`;
  });
}

function rewritePlaylist(body, sourceUrl, ctx) {
  const text = body.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  let maxSegmentDuration = 0;
  let targetDurationIndex = -1;

  lines.forEach((line, index) => {
    const duration = line.match(/^#EXTINF:([0-9]+(?:\.[0-9]+)?)/i);
    if (duration) maxSegmentDuration = Math.max(maxSegmentDuration, Number(duration[1]));
    if (/^#EXT-X-TARGETDURATION:/i.test(line)) targetDurationIndex = index;
  });

  if (targetDurationIndex >= 0 && maxSegmentDuration > 0) {
    const currentTarget = Number(lines[targetDurationIndex].split(':')[1]);
    const safeTarget = Math.max(Number.isFinite(currentTarget) ? currentTarget : 0, Math.ceil(maxSegmentDuration));
    lines[targetDurationIndex] = `#EXT-X-TARGETDURATION:${safeTarget}`;
  }

  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] === '#') return rewriteAttributeUris(line, sourceUrl, ctx);

    let resolved;
    try {
      resolved = new URL(trimmed, sourceUrl);
    } catch (error) {
      return line;
    }
    if (!['http:', 'https:'].includes(resolved.protocol)) return line;
    return proxyUrl(ctx, resolved.toString());
  }).join('\n');
}

class HlsProxyService extends Service {
  async proxy(rawUrl) {
    const { ctx } = this;
    const target = getExternalUrl(rawUrl);
    if (!target) {
      ctx.status = 400;
      ctx.body = 'Invalid HLS URL';
      return;
    }

    if (target.pathname === '/hls-proxy') {
      ctx.status = 400;
      ctx.body = 'Invalid HLS URL';
      return;
    }

    const range = ctx.request.headers.range;
    let response;
    try {
      response = await axios.get(target.toString(), {
        responseType: 'arraybuffer',
        timeout: REQUEST_TIMEOUT,
        maxContentLength: MAX_SEGMENT_SIZE,
        maxRedirects: 5,
        validateStatus: status => status >= 200 && status < 300,
        headers: {
          Accept: '*/*',
          'User-Agent': ctx.get('user-agent') || 'Mozilla/5.0 HLS Proxy',
          ...(range ? { Range: range } : {}),
        },
      });
    } catch (error) {
      ctx.status = error.response && error.response.status || 502;
      ctx.body = 'HLS upstream unavailable';
      return;
    }

    const body = Buffer.from(response.data || '');
    const responseUrl = getResponseUrl(response, target.toString());
    const contentType = response.headers['content-type'] || '';
    const playlist = isPlaylist(responseUrl, body, contentType);

    if (playlist && body.length > MAX_PLAYLIST_SIZE) {
      ctx.status = 502;
      ctx.body = 'HLS playlist is too large';
      return;
    }

    if (playlist) {
      const rewritten = Buffer.from(rewritePlaylist(body, responseUrl, ctx), 'utf8');
      ctx.status = response.status;
      ctx.set({
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Content-Length': String(rewritten.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      ctx.body = rewritten;
      return;
    }

    ctx.status = response.status;
    ctx.set({
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    });
    if (response.headers['accept-ranges']) ctx.set('Accept-Ranges', response.headers['accept-ranges']);
    if (response.headers['content-range']) ctx.set('Content-Range', response.headers['content-range']);
    ctx.body = body;
  }
}

module.exports = HlsProxyService;
