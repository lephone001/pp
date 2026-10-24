module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Note = new Schema({
    uid: { type: Schema.Types.ObjectId },
    category: { type: String },
    tags: { type: Array, default: [] },
    title: { type: String, unique: true, trim: true, index: true },
    isTop: { type: Number },
    sort: { type: Number },
    content: { type: String },
    description: { type: String, trim: true, default: '' },
    uname:{ type: String },
  }, {
    collection: 'note',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  } // schema 的选项options
  );
  return mongoose.model('note', Note);
};
