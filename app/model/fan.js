

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Fan = new Schema({
    title: {
      type: String, index: true
    },
    keywords:{
      type: String
    },
    description:{
      type: String
    },
    fcid:{ type: Schema.Types.ObjectId,index: true },
    uname: {
      type: String, index: true // pc h5 android ios
    },
    uid: { type: Schema.Types.ObjectId },
    view:{type:Number,index:true,default:0},
    index:{type:Number,index:true},
    fromObj:{ type: Object },//id:原始_id server:'来自服务器的ip'
  },
    {
      collection: 'fanword',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
  Fan.index({ 'fromObj.server': 1, 'fromObj.id': 1 });
  return mongoose.model('fanword', Fan);
};
