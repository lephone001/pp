
const { isIP } = require('net');
const { spliderListBlock, blackIpList,whiteDomainList } = require('../blackip')
module.exports = (option, app) => {
    return async function common(ctx, next) {
        try{
        let nowUrl = ctx.url;
        if(ctx.request.host&&isIP(ctx.request.host)&&nowUrl&&nowUrl.indexOf('/api/')==-1&&nowUrl.indexOf('/dist/index.html')==-1){
            ctx.status = 403; 
            ctx.body = '';
            return;
        }
        //禁止黑名单ip
        let clientIp = ctx.request.ip;
        if(clientIp){
            clientIp = clientIp.toLowerCase();
        }
        let userAgentA = ctx.request.header['user-agent']
        let host = ctx.request.host;

        // let isMobile = false;
        let isSpider = false;
        // let referer = ctx.request.header['referer'];
        let isBlackSpider = false;
        let sUserAgent = ''
        if (userAgentA) {
            sUserAgent = userAgentA.toLowerCase();
        }
        if (sUserAgent) {
            sUserAgent = sUserAgent.replace(/\s/g, '')
            // if (sUserAgent.indexOf('phone') > -1 || sUserAgent.indexOf('android') > -1 || sUserAgent.indexOf('mobile') > -1) {
            //     isMobile = true;
            // }
            isSpider = (sUserAgent.indexOf('bot') >= 0 || sUserAgent.indexOf('spider') >= 0)
        }
       
        let isBlackIp = false;
        let isWhiteIp = false;
        let isBaiduSpider = false;
        if(isSpider&&sUserAgent.indexOf('baidu')>=0){
            isBaiduSpider = true;
        }
        for(let item of blackIpList){
            if(clientIp.indexOf(item)==0){
                isBlackIp = true;
                break;
            }
        }
        if(isBlackIp&&!isBaiduSpider) {
            ctx.status = 403; 
            ctx.body = '';
            return;
        }
        //过滤白名单
        for (let item of whiteDomainList) {
            if (host.indexOf(item) >= 0) {
                isWhiteIp = true;
                isBlackIp = false;
                break;
            }
        }
        if(isWhiteIp) return next();
        //禁止黑名单蜘蛛
        // console.log(userAgentA)
        for(let item of spliderListBlock){
            if(sUserAgent.indexOf(item)>=0&&isSpider){
                isBlackSpider = true;
                break;
            }
        }
        if(isBlackSpider){
            ctx.status = 403;ctx.body = '';
            return;
        }
        //判断是否禁止访问
        await next();
            
        }catch{
             await next();
        }
    }
}