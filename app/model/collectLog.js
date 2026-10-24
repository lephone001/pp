module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const CollectLog = new Schema({
    taskId: { type: Schema.Types.ObjectId, ref: 'collect_task', required: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'collect_source' },
    movieId: { type: Schema.Types.ObjectId, ref: 'movie' },
    videoId: { type: Schema.Types.ObjectId, ref: 'video_video' },
    level: { type: String, default: 'info' },
    action: { type: String, default: '' },
    message: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: {} },
  }, { collection: 'collect_log', timestamps: { createdAt: 'createdAt', updatedAt: false } });
  CollectLog.index({ taskId: 1, createdAt: -1 }, { name: 'collect_log_task_created' });
  return mongoose.model('collect_log', CollectLog);
};
