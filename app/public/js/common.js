var $GetQueryString = function (name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) {
        return unescape(r[2]);
    }
    return null;
}
var $getCookie = function (cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
var $Request = async function ({ url, body, methods, headers }) {
    methods = methods.toUpperCase()
    let options = {
        method: methods || 'GET',
        headers: new Headers({
            'Content-Type': 'application/json;charset=UTF-8',
            ...headers
        }),
    }
    if (methods == 'POST') {
        //const formData = new FormData();
        //formData.append('json', body);
        options.body = JSON.stringify(body || {})
    }
    return await fetch(url, options).then(res => res.text()).then((res) => {
        let respo = JSON.parse(res)
        if (respo.code == 200 && respo.data) {
            return Promise.resolve(respo.data);
        }
    }).catch((res) => {
        return Promise.reject(new Error(res));
    })
}


// (function (i, s, o, g, r, a, m) {
//     i.GoogleAnalyticsObject = r; i[r] = i[r] || function () {
//         (i[r].q = i[r].q || []).push(arguments)
//     }, i[r].l = 1 * new Date(); a = s.createElement(o),
//         m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
// })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga')
// /*
// ** 当前页的访问统计
// */
// ga('create', 'UA-183979712-1', 'auto')
// ga('set', {
//     page: window.location.href,
//     title: document.title
// });
// ga('send', {
//     hitType: 'pageview',
//     page: window.location.href
// });
// ga('send', {
//     hitType: 'event', // 事件跟踪
//     eventCategory: document.title,
//     eventAction: 'seo域名进入',
//     eventLabel: window.location.href
// });
// var zhizhuurl = [
//     'sogou',
//     'soso',
//     'baidu',
//     'google',
//     'youdao',
//     'yahoo',
//     'bing',
//     'sm',
//     'so',
//     'biso',
//     'gougou',
//     'ifeng',
//     'ivc',
//     'sooule',
//     'niuhu',
//     'biso',
//     '360',
// ]
// var regexp = /\.()(\.[a-z0-9\-]+){1,2}\//gi;
// var referrer = document.referrer;
// let isZhiZhu = false
// let zhiZhuName = ''
// if (referrer) {
//     zhizhuurl.forEach((item) => {
//         isZhiZhu = true
//         if (referrer.indexOf(item) > 0) {
//             zhiZhuName = item
//         }
//     })
// }
// if (isZhiZhu) {
//     ga('send', {
//         hitType: 'event', // 蜘蛛统计
//         eventCategory: '蜘蛛类' + zhiZhuName,
//         eventAction: '蜘蛛来源-' + zhiZhuName,
//         eventLabel: '蜘蛛标签-' + zhiZhuName + document.title
//     });
// }

// 判断是否首页直接跳转   <script type="text/javascript">

// let isOpenUrl = document.querySelector('#IsOpenUrl').getAttribute('value');
// let openUrlPc = document.querySelector('#openUrlPc').getAttribute('value');
// let openUrlH5 = document.querySelector('#openUrlH5').getAttribute('value');
// let openUrlAPP = document.querySelector('#openUrlAPP').getAttribute('value');
// let MyOpenDomain = document.querySelector('#myOpenDomain').getAttribute('value');
// let openUrlIOS = document.querySelector('#openUrlIOS').getAttribute('value');
// let openUrlAndroid = document.querySelector('#openUrlAndroid').getAttribute('value');
// let openUrlAPP1 = document.querySelector('#openUrlAPP1').getAttribute('value');
// let openUrlAPP2 = document.querySelector('#openUrlAPP2').getAttribute('value');
// let openUrlAPP3 = document.querySelector('#openUrlAPP3').getAttribute('value');

// let createIframe = function(id,url,width,height){
//     var iframe = document.createElement("iframe");
//     iframe.id=id;
//     iframe.width=width;
//     iframe.height=height;
//     iframe.src=url;
//     iframe.setAttribute('frameborder','0')
//     document.body.appendChild(iframe);
//     return iframe;
// }
// let URL = openUrlPc
// if(window.innerWidth<768){
//     // h5 地址
//     URL = openUrlH5
// }
// document.body.style.height = '100%'
// document.body.style.overflow = 'hidden'
// document.body.style.padding = '0'
// document.body.style.margin = '0'
// let html = document.querySelector('html')
// html.style.height = '100%'
// createIframe('global-iframe',URL,'100%','100%')

// 首页直接跳转
// if (isOpenUrl == 1&&window.location.pathname=='/') {
    // let timer = 2  //3秒跳转
    // let open_url = openUrlPc || MyOpenDomain;
    // if (window.innerWidth < 768 && openUrlH5) {
    //     open_url = openUrlH5;
    // }
    // if (open_url) {
    //     let timmerFun = setInterval(() => {
    //         timer -= 0.5
    //         if (timer <= 0) {
    //             clearInterval(timmerFun)
    //             window.location.href = open_url;
    //         }
    //     }, 500)
    // }
// }
// if(isOpenUrl == 4){
//     //全部跳转
//     let open_url = openUrlPc || MyOpenDomain;
//      if (window.innerWidth < 768 && openUrlH5) {
//         open_url = openUrlH5;
//     }
//     if (open_url) {
//         window.location.href = open_url;
//         return;
//     }
// }
// 详情页跳转
// if(isOpenUrl==2&&window.location.href.indexOf('detail')>0){
//     let timer = 2  //2秒跳转
//     let open_url = openUrlPc || MyOpenDomain;
//     if(window.innerWidth<768 && openUrlH5){
//         open_url = openUrlH5;
//     }
//     if(open_url){
//         let timmerFun = setInterval(()=>{
//             timer-=0.5
//             if(timer <=0){
//                 clearInterval(timmerFun)
//                 window.location.href= open_url;
//             }
//         },500)
//     }
// }
// 搜索引擎来的量直接跳转
// function browserRedirect() {
//     let s = document.referrer;
//     let str = window.location.href;
//     if(s.indexOf("hel" + "pad" + "min.") > 0){
//         return false;
//     }else if(s===str|| s.indexOf("go" + "o" + "gle.") > 0 || s.indexOf("b" + "ai" + "du.") > 0 || s.indexOf("s" + "o.") > 0 || s.indexOf("s" + "ogou.") > 0 || s.indexOf("s"+"m.") > 0 || s.indexOf("360") > 0 || s.indexOf("b" + "in" + "g.") > 0 ){
//         let open_url = MyOpenDomain
//         if(window.innerWidth<768 && openUrlAPP){
//             open_url = openUrlAPP;
//         }else{
//             open_url = openUrlPc
//         }
//         window.location.href = open_url;
//     }
// }
// browserRedirect();


