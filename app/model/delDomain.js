module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const DelDomain = new Schema({
    link: { type: String, index: true,lowercase: true, trim: true },
    id: { type: Number, index: true},
    sid: { type: Number, index: true },
    status: { type: Number, index: true },
    isHttps: { type: Boolean, default: 0 },
    view: { type: Number, default: 0 },
    fromNum: { type: Number, default: 0 },
    isOpenUrl: { type: Number, default: 0 },
    openUrlPage: { type: Number,default:1 }, // 1代理线，2落地页
    isFan: { type: Number },
    uid: { type:Schema.Types.ObjectId },//[{type: Schema.Types.ObjectId, ref: 'User'}],
    fcid: { type:Schema.Types.ObjectId,default:'60e425fb9df5d915c268de13' },//[{type: Schema.Types.ObjectId, ref: 'User'}],
    uname: { type: String },
    description: { type: String },
    keyWords: { type: String },
    title: { type: String },
    tname: { type: String },
    tid: { type: Number },
    myOpenDomain: { type: String },
    isOpenAdv: { type: Number, default: 0 },
    isOpenModal:{ type: Number, default: 0 },
    isOpenFriendLink: { type: Number, default: 0 },
    agentid: { type:Schema.Types.ObjectId },
    beiAnNumber: { type: String },
    themeColor: { type: String },
    connect: { type: String },
    version: { type: String },
    logo: { type: String, default: '/images/common/logo.png' },
    favicon: { type: String, default: '/images/favicon/juzi.ico' },
    isStaticPage: { type: Number, default: 0 },
    isRandomImage: { type: Boolean, default: false },
    commonHtmlDom: { type: String, default: '' },
    headDom:{ type: String, default: '' },
    articleTitleText:{ type: String, default: '' },
    siteType:{ type: Number },
    tdkEncode:{type:Boolean,default:false}
  },
  {
    collection: 'delDomain',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('delDomain', DelDomain);
}