'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;

  const NavCollectTask = new Schema({
    sourceUrl: { type: String, required: true },
    pageTitle: { type: String, default: '' },
    status: { type: String, enum: [ 'preview', 'completed', 'failed' ], default: 'preview', index: true },
    itemCount: { type: Number, default: 0 },
    savedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    deletedCount: { type: Number, default: 0 },
    uid: { type: Schema.Types.ObjectId, index: true },
    uname: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  }, {
    collection: 'nav_collect_task',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  return mongoose.model('navCollectTask', NavCollectTask);
};
