module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const AppCategory = new Schema({
      name: {
        type: String,
        index: true
      },
      oname: {
        type: String,
      },
      id:{ type: Number },
      details:[],// 
      childrens:[
        { type: Schema.Types.ObjectId, ref: 'appCategory' },
      ],
      //站点配置相关
      status: { type: Number },
      sort: { type: Number, default: 0, },
      view: { type: Number },
      isHot: { type: Number },
      themeColor: { type: String, default: '', },
      uid: { type: Schema.Types.ObjectId },
      num: { type: Number, default: 0, },
      icon: { type: String, default: '', },
      image: {
        type: String,
        default: '',
      },
      keywords: {
        type: String,
        default: '',
      },
      description: {
        type: String,
        default: '',
      },
      siteType: { type: Number, default: 4, },
      sid:{ type: Number},
          fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    }, {
      collection: 'appCategory',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  
    return mongoose.model('appCategory', AppCategory);
  }
  
  
  