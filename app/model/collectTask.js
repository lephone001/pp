module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const CollectTask = new Schema({
    siteType: { type: Number, default: 11, index: true },
    collectType: { type: String, enum: [ 'video', 'book', 'image' ], default: 'video', index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'collect_source', required: true },
    mode: { type: String, enum: [ 'full', 'incremental' ], default: 'incremental' },
    status: { type: String, enum: [ 'pending', 'running', 'paused', 'success', 'failed', 'canceled' ], default: 'pending' },
    page: { type: Number, default: 1 },
    maxPages: { type: Number, default: 10 },
    allPages: { type: Boolean, default: false },
    endPage: { type: Number, default: 0 },
    cursor: { type: String, default: '' },
    totalPages: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    message: { type: String, default: '' },
    error: { type: String, default: '' },
    lockToken: { type: String, default: '' },
    heartbeatAt: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    requestedBy: { type: Schema.Types.ObjectId, default: null },
  }, { collection: 'collect_task', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  CollectTask.index({ sourceId: 1, status: 1, createdAt: -1 }, { name: 'collect_task_source_status' });
  return mongoose.model('collect_task', CollectTask);
};
