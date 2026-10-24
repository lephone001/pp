var moment = require('moment')
moment.locale('zh-CN');
//post请求权限加密
module.exports = () => {
    return async function (ctx, next) {
        // 获取url 上面的参数
        let auth = ctx.headers['auth']
        if (!auth || auth.length > 500) return ctx.body = {
            code: -1,
            message: "1-不允许操作！",
        }
        // 规则 Math.floor(Math.random()*100000000)+'15641534'+(Date.now()+587415234576)+'2-2'+ Math.floor(Math.random()*100000000)
        let star = auth.indexOf('15641534')
        let end = auth.indexOf('2-2')
        let nowTime = auth.slice(star + 8, end) - 587415234576
        const dateObject = new Date(nowTime)
        const nowDateObject = new Date()
        let userTime = '1'+dateObject.getMonth() + '' + dateObject.getDay() + '' + dateObject.getDate() +'' + dateObject.getHours()
        let serverTime = '1'+nowDateObject.getMonth() + '' + nowDateObject.getDay() + '' + nowDateObject.getDate() +'' + nowDateObject.getHours()
        if (Number(userTime)< Number(serverTime)+3&&Number(userTime)>Number(serverTime)-3) {
            await next()
        }else{
            return ctx.body = {
                code: -2,
                message: "2-不允许操作！",
            }
        }
    };
};
