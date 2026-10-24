module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Movie = new Schema({
    sourceId: { type: String, required: true },
    vodId: { type: String, required: true },
    name: { type: String, required: true, index: true },
    subName: { type: String, default: '' },
    enName: { type: String, default: '' },
    typeId: { type: String, default: '', index: true },
    typeName: { type: String, default: '' },
    year: { type: String, default: '', index: true },
    area: { type: String, default: '' },
    lang: { type: String, default: '' },
    actor: { type: String, default: '', index: true },
    director: { type: String, default: '', index: true },
    writer: { type: String, default: '' },
    cover: { type: String, default: '' },
    coverBig: { type: String, default: '' },
    remark: { type: String, default: '' },
    content: { type: String, default: '' },
    score: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
    isEnd: { type: Number, default: 0 },
    episodeCount: { type: Number, default: 0 },
    tags: { type: [ String ], default: [] },
    firstLetter: { type: String, default: '' },
    pinyin: { type: String, default: '' },
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    publishTime: { type: Date },
    updateTime: { type: Date },
    siteType: { type: Number, default: 11, index: true },
  }, {
    collection: 'movie',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  Movie.index({ sourceId: 1, vodId: 1 }, { unique: true, name: 'movie_source_vod_unique' });
  Movie.index({ typeId: 1, status: 1, updateTime: -1 }, { name: 'movie_type_status_update' });
  Movie.index({ siteType: 1, status: 1, updatedAt: -1 }, { name: 'movie_site_status_updated' });
  return mongoose.model('movie', Movie);
};
