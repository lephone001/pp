'use strict';
module.exports = app => {
  const schema = new app.mongoose.Schema({
    name: { type: String, required: true, unique: true }, description: String, sort: { type: Number, default: 0 },
    syncKeys: { type: [String], default: [] },
  }, { collection: 'wenzhangCate', timestamps: true });
  return app.mongoose.model('wenzhangCate', schema);
};
