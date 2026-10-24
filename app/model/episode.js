module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Episode = new Schema({
    movieId: { type: Schema.Types.ObjectId, ref: 'movie', required: true },
    episode: { type: Number, required: true },
    episodeName: { type: String, default: '' },
    sort: { type: Number, default: 0 },
    duration: { type: String, default: '' },
    status: { type: Number, default: 1 },
  }, { collection: 'episode', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  Episode.index({ movieId: 1, episode: 1 }, { unique: true, name: 'episode_movie_episode_unique' });
  return mongoose.model('episode', Episode);
};
