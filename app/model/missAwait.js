

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MissAwait = new Schema({
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
    copyid: { type: String },
    bust: { type: String },
    height: { type: String },
    weight: { type: String },
    job: { type: String },
    missType: { type: String },
    overview: { type: Number },
    //站点配置相关
    status: { type: Number },
    missPass: { type: Number },
    image_list: { type: String },
    video_list: { type: String },
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
  },
  {
    collection: 'miss_await_upload',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('miss_await_upload', MissAwait);
};
