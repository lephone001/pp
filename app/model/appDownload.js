module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  delete Schema.reserved.isNew;
  const AppDownload = new Schema({
    index: { type: String, index: true },
    name: { type: String },
    view: { type: Number, default: 0 },
    star: { type: Number, default: 0 },
    url: { type: String },
    image: { type: String },
    iosUrl: { type: String },
    desc: { type: String },
    isBt: { type: Number, default: 0 },
    type: { type: Number, default: 1 },
    isHot: { type: Number, default: 0 },
    isNew: { type: Number, default: 0 },
    isTop: { type: Number, default: 0 },
    sort: { type: Number, default: 0 },
    user: { type: String },
    status: { type: Number, default: 1 },
    createTime: { type: String },
    updateTime: { type: String },
    id: { type: Number, index: true },
    keywords: { type: String },
    description: { type: String },
    content: { type: String },
    title: { type: String },
  }, {
    collection: 'appDownload',
    usePushEach: true,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  return mongoose.model('appDownload', AppDownload);
};
