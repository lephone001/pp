

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const Nav = new Schema({
    reffer: {
      type: String,
    },
    //站点配置相关
    navType: { type: Number },
    isOpenNewPage: { type:Number },
    status: { type:Number },
    uid: { type: Number },
    navCategory: {
      type: String,
      allowNull: false,
    },
    image: {
      type: String,
    },
    link: {
      type: String,
      allowNull: false,
      len: [1, 50],
    },
    logo: {
      type: String,
    },
    description: {
      allowNull: true,
      type: String,
    }
  },
  {
    collection: 'nav_nav',
    usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
  });
  return mongoose.model('nav_nav', Nav);
};