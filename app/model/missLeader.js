

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissLeader = new Schema({
    title: {
      type: String,
    },
    provinceId: { type: Number },
    categoryId: { type: Number },
    cityId: { type: Number },
    up_uid: { type: Object },
    up_username: { type: String },
    pay_view: { type: Number },
    type: { type: Number },
    missType: { type: String },
    copyid: { type: String },
    job: { type: String },
    overview: { type: Number },
    //站点配置相关
    status: { type: Number },
    missPass: { type: Number },
    image_list: { type: String },
    video_list: { type: String },
    bust: { type: String },
    height: { type: String },
    weight: { type: String },
    price: { type: String },
    contact_information: { type: String },
    isShowInfoContent: { type: Number },
    service: { type: String },
    remarks: { type: String },
    environment: { type: String },
    service_time: { type: String },
    safety_assessment: { type: String },
    num: { type: String },
    age: { type: String },
    figure: { type: String },
    info_from: { type: String },
    detail_address: { type: String },
    content: { type: String },
    view: { type: Number},
    isHot: { type: Number },
    isTop: { type: Number },
    time: { type: String },
    star: { type: Number},
    bad: { type: Number},
    leaderId: { type: Number },
    leaderUserName: { type: String },
    // recordType=agent 表示代理资料；历史数据没有该字段，默认按代理名下信息兼容处理。
    recordType: { type: String, default: 'miss' },
    leaderName: { type: String },
    leaderHeader: { type: String },
    leaderCity: { type: String },
    leaderRz: { type: Number },
    leaderCj: { type: Number },
    leaderScore: { type: Number },
    leaderDescription: { type: String },
    leaderSort: { type: Number },
    leaderStatus: { type: Number, default: 1 },
  }, 
  {
    collection: 'miss_leader_miss',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  MissLeader.index({ recordType: 1, leaderStatus: 1, leaderSort: -1, leaderId: 1 });
  MissLeader.index({ leaderId: 1, status: 1, _id: -1 });
  return mongoose.model('miss_leader_miss', MissLeader);
};
