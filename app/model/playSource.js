module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const PlaySource = new Schema({
    movieId: { type: Schema.Types.ObjectId, ref: 'movie', required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    playerType: { type: String, default: 'm3u8' },
    sort: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
  }, { collection: 'play_source', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  PlaySource.index({ movieId: 1, code: 1 }, { unique: true, name: 'play_source_movie_code_unique' });
  return mongoose.model('play_source', PlaySource);
};
