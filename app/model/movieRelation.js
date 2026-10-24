module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const MovieRelation = new Schema({
    movieId: { type: Schema.Types.ObjectId, ref: 'movie', required: true },
    relatedMovieId: { type: Schema.Types.ObjectId, ref: 'movie', required: true },
    type: { type: String, default: 'recommend' },
    sort: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
  }, { collection: 'movie_relation', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  MovieRelation.index({ movieId: 1, relatedMovieId: 1, type: 1 }, { unique: true, name: 'movie_relation_unique' });
  return mongoose.model('movie_relation', MovieRelation);
};
