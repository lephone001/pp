'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Upload = new Schema({
    // Legacy fields kept for existing upload records.
    name: { type: String },
    uid: { type: Number },
    sid: { type: Number },
    username: { type: String },
    type: { type: Number },
    typeName: { type: String },
    sitename: { type: String },
    path: { type: String },
    size: { type: Number },

    // Common metadata for the miss upload module.
    originalName: { type: String },
    filename: { type: String },
    url: { type: String },
    relativePath: { type: String },
    storagePath: { type: String },
    ext: { type: String },
    mime: { type: String },
    sizeBytes: { type: Number },
    module: { type: String },
    siteType: { type: Number },
    // Source-server uploads are received by this application and retain
    // their origin for administration and troubleshooting.
    uploadMode: { type: String, default: 'local' },
    sourceServer: { type: String },
    sourcePort: { type: Number },
    sourceDomain: { type: String },
    status: { type: Number, default: 1 },
  }, {
    collection: 'upload',
    usePushEach: true,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });
  Upload.index({ module: 1, siteType: 1, createdAt: -1 });
  return mongoose.model('upload', Upload);
};
