module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Huahua = new Schema({
      title: {
        type: String,
      },
      name: {type: String},
      filePath: { type:String },
      poster: { type: String },
      view: { type: Number},
      star: { type:Number },
      bad: { type:Number },
      isTop: { type: Number },//0 全部 
      isHot: { type: Number },//0 全部 
      status: { type: Number },//0 全部 
      type:{ type: Number },//1 第一块硬盘对应ip段 全部 
      width:{ type: Number },
      height: { type: Number },
      viewUrl: { type: String },
      size: { type: Number,index:true,unique: true},
      duration: { type: String },
    },
    {
      collection: 'huahua',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('huahua', Huahua);
  };

