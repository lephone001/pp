module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Coindata = new Schema({
        available_supply: { type: Number },
        id:  { type: String },
        last_updated: { type: Number },
        logo:  { type: String },
        logo_png:  { type: String },
        market_cap_usd: { type: Number },
        max_supply: { type: Number },
        name:  { type: String,index:true },
        percent_change_1h: { type: Number },
        percent_change_7d: { type: Number },
        percent_change_24h: { type: Number },
        price_btc: { type: Number },
        price_usd: { type: Number },
        rank: { type: Number },
        symbol:  { type: String },
        total_supply: { type: Number },
        volume_24h_usd: { type: Number },
    },
    {
      collection: 'coindata',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('coindata', Coindata);
  }