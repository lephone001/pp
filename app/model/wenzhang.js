'use strict';
module.exports = app => {
  const S = app.mongoose.Schema;
  const schema = new S({
    title: { type: String, required: true }, description: String, content: String, image: String,
    categoryId: { type: S.Types.ObjectId, ref: 'wenzhangCate', default: null },
    sourceId: { type: S.Types.ObjectId, ref: 'wenzhangSource', default: null },
    sourceName: String, sourceUrl: String, publishedAt: Date,
    status: { type: Number, default: 1 },
  }, { collection: 'wenzhang', timestamps: true });
  schema.index({ sourceUrl: 1 }, { unique: true, partialFilterExpression: { sourceUrl: { $type: 'string' } } });
  schema.index({ status: 1, categoryId: 1, _id: -1 });
  schema.index({ status: 1, _id: -1 });
  return app.mongoose.model('wenzhang', schema);
};
