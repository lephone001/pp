module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Adv = new Schema({
      title:{ type: String },
      ip: { type: String },
      readStatus:  { type: Number, index: true },
      uid:  { type: Number, index: true },
      sid:  { type: Number, index: true },
      reaply: { type: String },
      status:  { type: Number, index: true },
      content:{ type: String },
  }, {
      collection: 'advice',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  } // schema 的选项options
  );
  return mongoose.model('advice', Adv);
};
