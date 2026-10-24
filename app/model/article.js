module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Article = new Schema({
      // _id: { type: Number},
      id:{ type: String},
      uid: { type: String  },
      sid: { type: Number  },
      cid:{ type: Schema.Types.ObjectId, ref: 'articleCategory' },
      articleCategory: { type: String  },
      title: { type: String,trim:true, },
      image: { type: String  },
      status: { type: Number},
      great: { type: Number  },
      isOpenUrl: { type: Number, default: 2 },//是否跳转 0 不跳转 1显示下载按钮不跳转 2直接跳转 3引擎reffer跳转 4自动三次引擎来路跳转
      fromNum: { type: Number, default: 0 },
      bad: { type: Number  },
      isHot: { type: Number },
      isTop: { type: Number },
      sort: { type: Number  },
      content: { type: String  },
      description: { type: String,trim:true,default:''  },
      view: { type: Number  },
      copyid: { type: String },
      time: { type: String },
      keywords: { type: String,trim:true,default:''  },
      otherContent: { type: String  },
      tag: { type: String },
    fromObj:{ type: Object },//id:'原始_id' server:'来自服务器的ip'

    }, { 
        collection: 'article',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('article', Article);
};
