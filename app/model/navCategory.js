'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const NavCategory = new Schema({
    name: {
      type: String,
      index: true,
    },
    oname: {
      type: String,
    },
    id: { type: Number },
    details: [{ type: Schema.Types.ObjectId, ref: 'nav_link' }],
    // parentId is the canonical hierarchy field. childrens is retained for old data.
    childrens: [{ type: Schema.Types.ObjectId, ref: 'navCategory' }],
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'navCategory',
      default: null,
      index: true,
    },
    level: {
      type: Number,
      default: 0,
      index: true,
    },
    siteType: {
      type: Number,
      default: 8,
      index: true,
    },
    status: { type: Number },
    sort: { type: Number, default: 0 },
    view: { type: Number },
    isHot: { type: Number },
    themeColor: { type: String, default: '' },
    uid: { type: Schema.Types.ObjectId },
    tags: {
      type: Array,
      default: [],
    },
    num: { type: Number, default: 0 },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    keywords: { type: String, default: '' },
    description: { type: String, default: '' },
    fromObj: { type: Object },
  }, {
    collection: 'navCategory',
    usePushEach: true,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  return mongoose.model('navCategory', NavCategory);
};
