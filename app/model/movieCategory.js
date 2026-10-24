module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Category = new Schema({
    siteType: { type: Number, default: 11, index: true },
    typeId: { type: String, required: true },
    name: { type: String, required: true, index: true },
    parentId: { type: String, default: '' },
    sort: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
    isHot: { type: Number, default: 0 },
    isTop: { type: Number, default: 0 },
    icon: { type: String, default: '' },
    description: { type: String, default: '' },
  }, { collection: 'category', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });
  Category.index({ siteType: 1, typeId: 1 }, { unique: true, name: 'category_site_type_id_unique' });
  Category.index({ siteType: 1, status: 1, isTop: 1, sort: 1 }, { name: 'category_site_top_sort' });
  return mongoose.model('movie_category', Category);
};
