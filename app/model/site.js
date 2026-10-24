module.exports = app => {
    const mongoose = app.mongoose;
    const Schema = mongoose.Schema;
  
    const Site = new Schema({
      sitename: { type: String  },
      id:{ type: Number,index:true,unique: true  },
      sitename: { type: String  },
      siteType: { type: Number  ,index:true},
      isNavNotice: { type: Number  },
      isNavBanner: { type: Number  },
      isNavArticle: { type: Number  },
      isFriendLink: { type: String  },
      status: { type: Number ,index:true },
      imgsrc: { type: String  },
      sort: { type: Number  },
      isHot: { type: Number  },
      view: { type: Number  },
      fromNum: { type: Number  },
      description: { type: String  },
      keyWords: { type: String  },
      favicon: { type: String  },
      logo: { type: String  },
      shareaholicImage: { type: String  },
      ogImage: { type: String  },
      themeColor: { type: String  },
      uid: { type: Object  },
      rulename: { type: String  },
      tid: { type: Number  },
      tname: { type: String  },
      uname: { type: String  },
      alreadyNavNum: { type: Number  },
      allowNavNum: { type: Number  },
      friendLinkSiteId: { type: Number  },
      useOtherFriendLink: { type: Number  },
      noticeContent: { type: String  },
      isStaticPage: { type: Number  },
      connect: { type: String  },
      gajs: { type: String  },
    },{
      collection: 'site',
      usePushEach: true, // 解决 Unknown modifier: $pushAll 报错，作用原理未知
      timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // 生成时间 
    });
    return mongoose.model('site', Site);
  }