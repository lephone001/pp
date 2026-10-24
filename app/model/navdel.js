

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Navdel = new Schema({
    nid:{ type:Schema.Types.ObjectId },
    referer:{
      type: String,
    }
  },
  {
    collection: 'nav_link_del',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('nav_link_del', Navdel);
};