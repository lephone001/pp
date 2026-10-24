'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Template = new Schema({
    siteType: { type: Number, required: true, index: true },
    imageView: { type: String, default: '' },
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    disabled: { type: Boolean, default: false, index: true },
    sort: { type: Number, default: 0, index: true },
  }, {
    collection: 'templates',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  Template.index({ siteType: 1, value: 1 }, {
    unique: true,
    name: 'templates_site_type_value_unique',
  });
  Template.index({ disabled: 1, siteType: 1, sort: 1, label: 1 });
  Template.index({ updatedAt: -1, _id: -1 });

  return mongoose.model('templates', Template);
};
