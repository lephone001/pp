

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Miss = new Schema({
    title: {type: String,},
    provinceId: { type: Number },
    categoryId: { type: Number },
    cityId: { type: Number },
    up_uid: { type: Number },
    up_username: { type: String },
    pay_view: { type: Number },
    type: { type: Number },
    copyid: { type: String },
    bust: { type: String },
    height: { type: String },
    weight: { type: String },
    missType: { type: String },
    job: { type: String },
    remarks: { type: String },
    overview: { type: Number },
    //站点配置相关
    status: { type: Number },
    image_list: { type: Array,default:[] },
    imageViewUrl: { type: String },
    video_list: { type: Array,default:[] },
    price: { type: String },
    contact_information: { type: String },
    isShowInfoContent: { type: Number },
    service: { type: String },
    environment: { type: String },
    service_time: { type: String },
    safety_assessment: { type: String },
    num: { type: String },
    age: { type: String },
    figure: { type: String },
    info_from: { type: String },
    detail_address: { type: String },
    content: { type: String },
    view: { type:Number },
    isHot: { type: Number },
    missPass: { type: Number },
    isTop: { type: Number },
    time: { type: String },
    star: { type:Number },
    bad: { type:Number },
    tags:{type:Array,default:[]},

    isCaiji: { type: Boolean, default: false },
    caijiUrl: { type: String, default: '' },
    caijiDate: { type: String, default: '' },
    caijiYuanchengImageList: { type: Array, default: [
      {oldUrl:"",newUrl:""},
    ] },
    caijiContent: { type: Array, default: [{ name: '', content: '' }] },
  }, 
  {
    collection: 'miss',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  Miss.index({ status: 1, isTop: -1, isHot: -1, _id: -1 }, { name: 'miss_display_sort' });
  Miss.index({ categoryId: 1, status: 1, _id: -1 }, { name: 'miss_category_status' });
  Miss.index({ cityId: 1, status: 1, _id: -1 }, { name: 'miss_city_status' });
  return mongoose.model('miss', Miss);
}



