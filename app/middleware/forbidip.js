const firbideip = require('./iplist')
const ipblack = require('./iplistblack')

module.exports = (option, app) => {
    return async function forbideIp(ctx, next) {
        // firbideip 数据可以来自数据库，也可以来自传参
        let clientIp = ctx.request.ip;
        // console.log(clientIp)
        if(!clientIp) {
             ctx.status = 500; 
             ctx.body = '';
             return
        }
        clientIp = clientIp.toLowerCase();
        // console.log(clientIp)
        let isBlackIp = false;
        for(let item of ipblack){
            if(clientIp.indexOf(item)==0){
                isBlackIp = true;
            }
        }
        if(isBlackIp) {
            ctx.status = 500; 
            ctx.body = '';
            return
        }
       
        let isDisabledIp = 0;
        if(clientIp.indexOf('baidu')>=0||clientIp.indexOf('sm')>=0||clientIp.indexOf('so')>=0){
            await next();
            return;
        }
        // console.time(1)
        for(let i =0;i<firbideip.length;i++){
            if(clientIp.indexOf(firbideip[i])==0){
                isDisabledIp = 1
            }
        }
        // if (firbideip.includes(clientIpBefore)) {
        //     isDisabledIp = 1
        // }
        // console.timeEnd(1)
        if (isDisabledIp) {
            await next();
        } else {
            ctx.status = 500;
            ctx.body = '';
        }
    }
}