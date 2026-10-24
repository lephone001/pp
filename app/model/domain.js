module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Domain = new Schema({
    link: { type: String, lowercase: true, required: true, unique: true, trim: true },
    id: { type: Number, index: true, unique: true },
    sid: { type: Number, index: true },
    cids: [{ type: Schema.Types.ObjectId, ref: 'articleCategory' }],
    navcids: [{ type: Schema.Types.ObjectId, ref: 'navCategory' }],
    status: { type: Number, index: true },//0 关闭 1 正常 2异常 3无法访问
    isHttps: { type: Boolean, default: false },
    view: { type: Number, default: 0 },
    fromNum: { type: Number, default: 0 },// 200 iframe 300 不iframe
    titleType:{type: Number, default: 0},//
    isOpenUrl: { type: Number, default: 0 },
    openUrlStatusCode:{type: Number, default: 0},//跳转状态码 目前主要针对目录和首页 200 301 302 307 308
    //是否跳转 
    //0 自动跳转（推荐） 自动三次引擎来路跳转 
    //-1 强制不开启 
    //-2 显示下载按钮不跳转 
    //2 仅内页跳转
    //3 强制开启 
    //5 H5跳转
    //6 H5引擎跳转
    //7 引擎跳转
    //8 仅内页跳转
    //9 目录及无页面 gogogo 跳转
    isJingXiang: { type: Number, default: 0 },//是否是镜像站点 0 关闭 1 iframe  2 copyhtml
    jingXiangUrl: { type: String },//镜像名称或者链接
    openUrlPage: { type: Number, default: 1 }, // 1代理线，2落地页
    isFan: { type: Number },//0 未开启 1 全局开启 2半开启
    typeList: { type: Array, default: [] },
    uid: { type: Schema.Types.ObjectId },//[{type: Schema.Types.ObjectId, ref: 'User'}],

    articleCompany: { type: Schema.Types.ObjectId, ref: "articleCompany"},//[{type: Schema.Types.ObjectId, ref: 'User'}],
    isArticleCompany:{ type: Boolean, default: false },
    fcid: { type: Schema.Types.ObjectId, ref: "fan_category", default: '60e425fb9df5d915c268de13' },//[{type: Schema.Types.ObjectId, ref: 'User'}],
    mcid: { type: Schema.Types.ObjectId, ref: "mulu_category"},//[{type: Schema.Types.ObjectId, ref: 'User'}],
    uname: { type: String },
    description: { type: String },
    keyWords: { type: String },
    title: { type: String },
    titleText: { type: String, default: '' },//影视名称 副标题短词
    titleText2:{ type: String, default: '' },//标题后缀 副标题长词
    tname: { type: String },
    imgTypeName: { type: String, default: 'bdmn-151' },
    tid: { type: Number },
    myOpenDomain: { type: String },
    isOpenAdv: { type: Number, default: 0 },
    advDom: { type: String, default: '' },//--
    modalDom: { type: String, default: '' },//--
    isOpenModal: { type: Number, default: 0 },
    isOpenFriendLink: { type: Number, default: 0 },
    friendLinkDom: { type: String, default: '' },//--
    isOutFriendLink: { type: Boolean, default: false, index: true },//站链接
    isSo: { type: Boolean, default: false },
    ispcpage: { type: Number, default: 1 },// -1强制未开启状态码500 0未开启显示隐藏页面 1正常 
    
    iscache: { type: Boolean, default: true },//是否缓存--
    agentid: { type: Schema.Types.ObjectId },
    beiAnNumber: { type: String },
    beiAnName: { type: String },
    themeColor: { type: String },
    connect: { type: String },
    version: { type: String },
    logo: { type: String, default: '/images/common/logo.png' },
    favicon: { type: String, default: '/images/favicon/juzi.ico' },
    isStaticPage: { type: Number, default: 0 },
    isRandomImage: { type: Boolean, default: false },
    commonHtmlDom: { type: String, default: '' },
    navsDom: { type: String, default: '' },
    headDom: { type: String, default: '' },
    isAdvOpen: { type: Boolean, default: false },
    siteType: { type: Number },
    tdkEncode: { type: Boolean, default: false },
    anip: { type: String, default: '' },
    isMuLu: { type: Boolean, default: false },
    isWordRandom: { type: Boolean, default: false },
    browserType: { type: String, default: '' },//站点针对得引擎类型 sogo baidu google biying sm 360
    cateDomainNavNum: { type: Number, default: 0 }, //关联导航分类总数
    // type403:{ type: Number, default: 0 },//0 正常  1 主域名打开403 2 

    pushSiteType: { type: Number, default: 0 },
    pushSiteStatus: { type: Number, default: 1 },//0 关闭 1开启 2异常
    pushSiteNum: { type: Number, default: 100 },
    pushSiteTokenName: { type: String, default: 'baidu' },
    pushSiteToken: { type: String, default: '' },
    pushSiteDay: { type: String, default: '' },

    fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'
  },
    {
      collection: 'domain',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  return mongoose.model('domain', Domain);
}
