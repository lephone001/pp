'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;

  const NavCollectItem = new Schema({
    taskId: { type: Schema.Types.ObjectId, ref: 'navCollectTask', required: true, index: true },
    sourceUrl: { type: String, required: true },
    link: { type: String, required: true },
    title: { type: String, default: '' },
    keywords: { type: String, default: '' },
    tags: { type: [ String ], default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: 'navCategory', default: null },
    selected: { type: Boolean, default: true },
    // 1 pending, 2 saved, 3 failed, 0 deleted.
    status: { type: Number, default: 1, index: true },
    errorMessage: { type: String, default: '' },
  }, {
    collection: 'nav_collect_item',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  NavCollectItem.index({ taskId: 1, link: 1 }, { unique: true });
  NavCollectItem.index({ taskId: 1, status: 1, createdAt: -1 });

  return mongoose.model('navCollectItem', NavCollectItem);
};
