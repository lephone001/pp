// app/middleware/favicon.js
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = () => {
    return async function favicon(ctx, next) {
        console.log(ctx.path)
        if (ctx.path === '/favicon.ico') {
            let { domain } = await ctx.service.utils.getSiteInfo();
            if (!domain || !domain.link) {
                return '';
            }
            const faviconPath = path.join(
                ctx.app.baseDir,
                `app/view/template/${domain.tname}`,
                `favicon.ico`
            );

            if (fs.existsSync(faviconPath)) {
                ctx.type = 'image/x-icon';
                ctx.set('Cache-Control', 'public, max-age=86400');
                ctx.body = fs.createReadStream(faviconPath);
                return;
            }
            ctx.type = 'image/x-icon';
            ctx.set('Cache-Control', 'public, max-age=86400');
            ctx.body = fs.createReadStream(path.join(
                ctx.app.baseDir,
                'app/public',
                `favicond.ico`
            ));
            return;
        }
        await next();
    };
};