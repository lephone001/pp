module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const PlayUrl = new Schema({
    movieId: { type: Schema.Types.ObjectId, ref: 'movie', required: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'episode', default: null },
    sourceId: { type: String, required: true },
    episode: { type: Number, default: 0 },
    title: { type: String, default: '' },
    url: { type: String, required: true },
    urlType: { type: String, default: 'm3u8' },
    sort: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
    headers: { type: Schema.Types.Mixed, default: {} },
  }, { collection: 'play_url', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  PlayUrl.index({ movieId: 1, sourceId: 1 }, { name: 'play_url_movie_source' });
  PlayUrl.index({ episodeId: 1, sourceId: 1 }, {
    unique: true,
    partialFilterExpression: { episodeId: { $type: 'objectId' } },
    name: 'play_url_episode_source_unique',
  });
  PlayUrl.index({ url: 1 }, { name: 'play_url_url' });
  return mongoose.model('play_url', PlayUrl);
};
