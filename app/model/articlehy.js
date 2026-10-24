module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
    const Articlehy = new Schema({
      // _id: { type: Number},
      uid: { type: Number  },
      sid: { type: Number , index: true },
      cid: { type: Number , index: true },
      articleCategory: { type: Array,index:true  },
      title: { type: String, unique: true ,trim:true,index: true },
      image: { type: String  },
      status: { type: Number },
      great: { type: Number  },
      bad: { type: Number  },
      isHot: { type: Number },
      isTop: { type: Number },
      sort: { type: Number  },
      content: { type: String  },
      description: { type: String,trim:true  },
      view: { type: Number  },
      from:{type: String},//来源网站
      fromNum: { type: Number  },
      copyid: { type: String  },
      time: { type: String  },
      keywords: { type: String  },
      otherContent: { type: String  },
      tag: { type: Array,index:true },
      imageList: { type: Array },
      uid:{ type: Number  }
    }, { 
        collection: 'articlehy',
        usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
      } // schema 的选项options
    );
    return mongoose.model('articlehy', Articlehy);
};
