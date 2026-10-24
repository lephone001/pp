'use strict';
module.exports = app => {
  const schema = new app.mongoose.Schema({
    name: { type: String, required: true }, url: { type: String, required: true, unique: true },
    categoryId: { type: app.mongoose.Schema.Types.ObjectId, ref: 'wenzhangCate', default: null },
    enabled: { type: Boolean, default: true }, auto: { type: Boolean, default: false },
    limit: { type: Number, default: 20 }, lastDate: String, lastRunAt: Date,
    lastResult: String, runningUntil: { type: Date, default: new Date(0) },
  }, { collection: 'wenzhangSource', timestamps: true });
  return app.mongoose.model('wenzhangSource', schema);
};
