module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Splider = new Schema({
    name: { type: String, unique: true, index: true },
    uname: { type: Schema.Types.ObjectId },
    uid: { type: Schema.Types.ObjectId, index: true },
    spliderList: {
      type: Array,
      default: [
        {
          baidu: true,
          soso: true,
          360: true,
          sogou: true,
          sm: true,
          byte: true,
          google: true,
          yisou: true,
          bing: true,
        }
      ]
    }
  }, {
    collection: 'splider',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  } // schema 的选项options
  );
  return mongoose.model('splider', Splider);
};
