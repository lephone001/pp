module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const SeoPage = new Schema({
    siteType: { type: Number, default: 11, index: true },
    movieId: { type: Schema.Types.ObjectId, ref: 'movie' },
    pageType: { type: String, required: true },
    path: { type: String, required: true },
    title: { type: String, default: '' },
    keywords: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: Number, default: 1 },
  }, { collection: 'seo_page', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  SeoPage.index({ siteType: 1, path: 1 }, { unique: true, name: 'seo_page_site_path_unique' });
  return mongoose.model('seo_page', SeoPage);
};
