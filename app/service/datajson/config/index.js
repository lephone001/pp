module.exports = {
    // 发布文章标题目录文件 当前文件夹下的文件夹
    titleFile:'/标题/欧洲杯.txt',
    // 随机文字目录
    randomWords:'/句子/欧洲杯.txt',
    // 随机图片目录
    randomImages:'/图片/美女.txt',
    // 是否开启随机文字 默认开启
    isRanDomWords:1,
    // 成功生成文章的目录 当前文件夹下的文件夹
    successFile:'/生成文章/1/',
    // 标题里面是否携带城市 1携带 0 不带 默认 1   携带城市标题重复的可能性小
    titleCity:1,
    // 推广域名格式随意【ayx-1.com】
    myDomain:'【ayx-1.com】',
    // 是否将推广域名放到文章标题 1携带 0 不带 默认 0 携带引擎收录后会出现标题
    isTitleDomain:1,
    // 推广线跳转地址 格式 http://www.ayx-1.com  
    jumpDomain:'http://www.ayx-1.com',
    // 是否将推广线地址放到文章里面 1携带 0 不带 默认 0 携带文章最上面是a标签 可点击跳转
    isJumpDomain:1,
    // 标题前指定插入文字  格式  爱游戏体育|
    titleBeforeText:'',
    // 标题后指定插入文字  格式 |爱游戏体育
    titleAfterText:'',
    // 文章的时间是否随机 1随机 2电脑当前的时间 默认1
    articleTime:1,
    // 文章生成的字数 文章长度 1 2 3 4... 建议5   【1】 短文章5-10行 【2】50-100【3】500-1000【4】5000-10000 
    articleLength:5,
    // 文章插入 混淆 0 不插入  1插入  默认 0
    isArticleHunXiao:1,
    //是否直接发布 默认0 1开启直接发布
    isFaBu:1,

    // dedeCMS 发布文章配置
    dede:{
        username:'admin',
        password:'123456',
        // 要发布的文章目录
        faBuFile:'/生成文章/1/',
        // 后台地址目录名
        dedeCMSMuLuName:'laojiu',
        // 发布成功后是否删除 1 删除  0不删除 
        isDeleteSuccess:1,
        // 要发布的域名 一行一个 格式 域名  分类 如果对应的站点是3就写3 category 栏目ID  -1为随机获取  categoryMax 随机获取最大区间默认 6
        domainPath:'/配置/发布文章域名dede.txt',
        category:-1,
        categoryMax:3
    },
    // wp 发布文章配置
    wp:{
        username:'',
        password:'',
        // 要发布的文章目录
        faBuFile:'/生成文章/1/',
        // 发布成功后是否删除 1 删除  0不删除 
        isDeleteSuccess:1,
        domainPath:'/配置/发布文章域名wp.txt',
        category:-1,
        categoryMax:3
    },
}