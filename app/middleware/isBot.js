


//编辑权限
module.exports = () => {
    return async function (ctx, next) {
        // let ua = ctx.request.header['user-agent']
        // // let referer = ctx.request.header['referer']
        // let isGoFanDomain = false
        // if (ua) {
        //     ua = ua.toLowerCase()
        //     let uaList = ['baiduspider', 'sosospider','360spider', 'yisouspider', 'bingbot', 'toutiao','bytespider','sogou']
        //     // let refererIndex = uaList.findIndex((item) => referer.indexOf(item) >= 0);
        //     let uaIndex = uaList.findIndex((item) => ua.indexOf(item) > 0);
        //     if (uaIndex>=0) {
        //         isGoFanDomain = true
        //     }
        // }
        // if (isGoFanDomain) {
        //     await next();
        // } else {
        //     return ctx.render('/404.html')
        // }
        await next();
    };
};
