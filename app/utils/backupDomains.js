'use strict';

const { isIP } = require('net');
const psl = require('psl');

// Expand every library entry three times, including explicit IPv4 preview prefixes.
module.exports = function backupDomains({ patterns = [], render, origin }) {
  const links = [];
  let parsedOrigin;
  try { parsedOrigin = new URL(origin); } catch (_) { return links; }
  const hostname = parsedOrigin.hostname.replace(/^\[|\]$/g, '');
  const rootDomain = isIP(hostname) ? hostname : psl.get(hostname) || hostname;
  patterns.forEach((pattern, row) => {
    for (let copy = 0; copy < 3; copy++) {
      const value = String(render(pattern, 'backup-domain-' + row + '-' + copy) || '').trim();
      if (!value || /[\s<>"'\\{}]/.test(value)) continue;
      const prefix = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value);
      if (prefix) {
        if (isIP(hostname) === 6) continue;
        const label = value.toLowerCase();
        // Preserve the user's requested prefix.IP:port format verbatim. URL()
        // rejects numeric-ending hostnames such as h5-12345.127.0.0.1.
        links.push({ url: parsedOrigin.protocol + '//' + label + '.' + rootDomain + (parsedOrigin.port ? ':' + parsedOrigin.port : '') + '/', title: label, pending: false });
        continue;
      }
      const candidate = /^(https?:)?\/\//i.test(value) || value.startsWith('/') ? value
          : /^[a-z0-9][a-z0-9.-]*\.[a-z][a-z0-9-]*(?::\d+)?(?:[/?#]|$)/i.test(value) ? parsedOrigin.protocol + '//' + value : '';
      if (!candidate) continue;
      try {
        const url = new URL(candidate, origin);
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) continue;
        links.push({ url: url.href, title: url.hostname, pending: false });
      } catch (_) { /* Invalid library entries do not become clickable URLs. */ }
    }
  });
  return links;
};
