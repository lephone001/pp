"use strict";
const Service = require("egg").Service;
const crypto = require("crypto");
const { Console } = require("console");
// const DATE_FORMATER = require('dateformat');

const sevenDaysTime = 3600 * 24 * 7;
// 秘钥
const secret = "hmg_btc_one";
// md5 加密
const md5 = function (content) {
  const md5 = crypto.createHash("md5");
  return md5.update(content).digest("hex"); // 把输出编程16进制的格式
};
// 加密函数
const genPassword = function (password) {
  const str = `password=${password}&key=${secret}`; // 拼接方式是自定的，只要包含密匙即可
  return md5(str);
};

class BtcService extends Service {
  // 支付
  async payBtc({ btcId, userId }) {
    return this.ctx.body = {
      code:-1,
      message:'暂时不支持金币支付!'
    }
    // vip 或者已经支付过的无需支付------
    const btcUser = await this.ctx.model.BtcUser.findOne({
      id: userId,
    });
    // 查看金币是否足够
    if (btcUser.coin < 1) {
      return { code: -1, message: "金币不足！" };
    }
    // 金币扣除
    await btcUser.update({_id:btcUser.id},{});

    const btc = await this.ctx.model.Btc.findById(btcId);
    // 添加到支付的表
    await this.ctx.model.Btcpay.create({
      btcId,
      userId,
    });
    // 存账单
    this.ctx.model.Btcbill.create({
      uid: userId,
      username: btcUser.username,
      type: "low",
      btcId,
      coin: 1,
      money: 0,
      status: 2,
      mask: "浏览小姐【联系方式】",
    });
    return {
      code: 200,
      data: btc.contact_information,
    };
  }
  // 查找用户
  async btcUserInfo(id) {
    const user = await this.ctx.model.BtcUser.findById(id);
    if (!user) {
      return { code: -1, message: "用户找不到！" };
    }
    // 查找邀请总人数
    const inviteCount = await this.ctx.model.BtcUser.countDocuments({
      userAgent: user.username,
    }, (err, c) => c);

    return {
      code: 200,
      data: user,
      inviteCount,
    };
  }
  /**
   * @description: 用户登录
   * @param {username,password}
   * @return:
   */
  async btcLogin(username = "", password = "") {
    const userInfo = await this.ctx.model.BtcUser.findOne({ username, password: genPassword(password) });
    // console.log(genPassword(password));
    // 设置登录时间
    if (!userInfo) return { message: "用户名或密码不正确！", code: -2 };
    await userInfo.update({ loginTime: new Date() });
    // 查找邀请总人数
    const inviteCount = await this.ctx.model.BtcUser.countDocuments({
      userAgent: userInfo.username,
    }, (err, c) => c);
    const payload = {
      exp: parseInt(Date.now() / 1000) + sevenDaysTime,
      username,
      password: genPassword(password),
      loginTime: userInfo.loginTime,
      id: userInfo.id,
      isAdmin: userInfo.isAdmin,
      isVip: userInfo.isVip,
      isLeader: userInfo.isLeader,
    };
    const token = this.app.jwt.sign(payload, secret);
    // 登录成功把用户名密码保存到SESSION
    // ctx.session.userInfo = payload
    // 检测vip 是否过期
    if (
      userInfo.forverVip == false &&
      userInfo.isVip &&
      Date.now(userInfo.vipEndDate) < Date.now()
    ) {
      await userInfo.update({ isVip: false });
    }
    // 存进redis
    await this.ctx.service.cache.set("btc-user-" + userInfo.username, payload);
    delete userInfo.password;
    return {
      code: 200,
      data: {
        userInfo,
        authorization: token,
        inviteCount,
      },
    };
  }
  /**
   * @description: 用户注册
   * @param {type}
   * @return:
   */
  async btcRegist({ username, password, inviteCode, email, registIP }) {
    // 检测IP是否已经存在
    // console.log('registIP', registIP)
    const isExsitIP = await this.ctx.model.BtcUser.count({
      limit: 11,
      where: {
        registIP,
      },
    });
    if (isExsitIP > 10) return { message: "注册已经超出上限！", code: -2 };
    // 先检查用户名称是否存在
    const isExsitUserName = await this.ctx.model.BtcUser.findOne({
      where: {
        username,
      },
    });
    if (isExsitUserName) return { message: "用户名称已存在！", code: -2 };
    // 检查邮箱是否存在
    const isExsitEmail = await this.ctx.model.BtcUser.findOne({
      where: {
        email,
      },
    });
    if (isExsitEmail) return { message: "邮箱已存在！", code: -2 };
    // 查找邀请人
    let userAgent = "";
    const isExsitInviteCode = await this.ctx.model.BtcUser.findOne({
      where: {
        inviteCode,
      },
    });
    if (!isExsitInviteCode) return { message: "邀请码错误!", code: -2 };
    userAgent = isExsitInviteCode.username;
    // 生成邀请码
    // let nowInviteCode = await this.ctx.model.BtcUser.max('inviteCode')
    const myInviteCode =
      Math.floor(Math.random() * (10000 - 1000)) +
      1000 +
      Date.now().toString().slice(9);
    // 对密码进行加密操作
    const hashPassword = genPassword(password);
    const createDate = new Date();
    // 注册等级默认为1 默认金币为 0
    await this.ctx.model.BtcUser.create({
      username,
      password: hashPassword,
      level: 1,
      coin: 0,
      honor: "5",
      isVip: 0,
      createDate,
      lastLoginTime: createDate,
      isAdmin: false,
      email,
      inviteCode: myInviteCode,
      userAgent,
      registIP,
      status: 1,
    });
    // 给被邀请用户增加金币
    isExsitInviteCode.increment("coin", { by: 2 });
    // 存账单
    this.ctx.model.Btcbill.create({
      uid: isExsitInviteCode.id,
      username: isExsitInviteCode.username,
      type: "add",
      coin: 2,
      money: 0,
      status: 1,
      mask: "邀请好友！",
    });
    return { message: "注册成功!", code: 200 };
  }
  async logout() {
    const dateTime = new Date();
    const username = this.service.utils.getTokenInfo("username");
    // console.log(dateTime, username)
    await this.ctx.model.BtcUser.update(
      {
        loginTime: dateTime,
        lastLoginTime: dateTime,
      },
      {
        where: {
          username,
        },
      }
    );
    return { message: "退出成功！", code: 200 };
  }

  // 修改密码
  async changePassword({ username, email, newPassword }) {
    const dateTime = new Date();
    // let username = this.service.utils.getTokenInfo('username');
    // console.log(dateTime, username)
    const user = await this.ctx.model.BtcUser.findOne({
      where: {
        username,
        email,
      },
    });
    if (!user) return { code: -2, message: "用户名或者邮箱不正确！" };
    await user.update({
      username,
      email,
      password: genPassword(newPassword),
    });
    return { message: "密码修改成功！", code: 200 };
  }

  // 充值 btcRecharge
  async recharge({ userId, cardPassword }) {
    // 获取发卡列表
    const card = await this.ctx.model.BtcFaka.findOne({
      where: {
        password: cardPassword,
      },
    });
    if (!card || card.status == 0) return { message: "卡密无效！", code: -2 };
    // 检查类型 0 100金币 1 100月会员 300 季度vip 1000永久vip
    const user = await this.ctx.model.BtcUser.findById(userId);
    // console.log(user)
    const oneDayTime = 1000 * 3600 * 24;
    let rechargeType = "会员";

    if (card.type == 0) {
      rechargeType = "充值100金币";
      await user.update({
        coin: user.coin + 100,
      });
    } else if (card.type == 1 || card.type == 2) {
      const day = card.type == 1 ? 30 : 90;
      rechargeType = card.type == 1 ? "充值1月会员" : "充值一季度会员";
      // 月会员
      let saveVipEndDate = null;
      if (user.vipEndDate && user.isVip) {
        // console.log(111, user.vipEndDate)
        // 如果是开通vip状态下  vip日期叠加
        const vipEndDate = new Date(user.vipEndDate).getTime();
        saveVipEndDate = vipEndDate + oneDayTime * day;
      } else {
        // 如果未开通vip
        saveVipEndDate = Date.now() + oneDayTime * day;
      }
      await user.update({
        isVip: true,
        vipEndDate: new Date(saveVipEndDate),
        vipStartDate: new Date(),
      });
      await user.reload();
    } else if (card.type == 3) {
      // 永久vip
      rechargeType = "充值永久会员";
      await user.update({
        isVip: true,
        vipEndDate: new Date("6060"),
        vipStartDate: new Date(),
        forverVip: true,
      });
      await user.reload();
    }
    // 设置卡片状态已被使用
    await card.update({
      status: 0,
      uid: userId,
      username: user.username,
    });
    // 存账单
    this.ctx.model.Btcbill.create({
      uid: userId,
      username: user.username,
      type: "add",
      coin: card.type == 0 ? 100 : 0,
      money: card.money,
      status: 1,
      mask: rechargeType,
    });
    // 签发新token
    const payload = {
      exp: parseInt(Date.now() / 1000) + sevenDaysTime,
      username: user.username,
      password: user.password,
      loginTime: user.loginTime,
      id: user.id,
      isAdmin: user.isAdmin,
      isVip: user.isVip,
    };
    const token = this.app.jwt.sign(payload, secret);
    return { code: 200, message: rechargeType + "充值成功！", token };
  }
  // 提现列表
  async withdraw({ id, coin, usdtUrl, usdtType }) {
    // 检测提现金额是否满足
    const user = await this.ctx.model.BtcUser.findById(id);
    if (coin < 1000) {
      return { message: "提现金币不能低于1000个", code: -2 };
    }
    if (user.coin < coin) {
      return {
        message: "提现金额不足！最多提现" + user.coin / 2 + "元",
        code: -2,
      };
    }
    await this.ctx.model.BtcWithdraw.create({
      uid: id,
      username: user.username,
      type: "low",
      coin,
      usdtUrl,
      usdtType,
      money: parseInt(coin / 2),
      status: 1,
      mask: "申请提现！",
    });

    // 减除提现金币
    await user.update({
      coin: user.coin - coin,
    });
    // 存账单
    this.ctx.model.Btcbill.create({
      uid: id,
      username: user.username,
      type: "low",
      coin,
      status: 1,
      mask: "提现",
    });
    return { message: "申请成功！", code: 200 };
  }
  async withdrawList({ id, offset = 0 }) {
    const isAdmin = this.service.utils.getTokenInfo("isAdmin");

    const options = {};
    if (!isAdmin) {
      options.uid = id;
    }
    const { count, rows } = await this.ctx.model.BtcWithdraw.findAndCountAll({
      limit: 30,
      where: options,
      offset,
      order: [["id", "desc"]],
    });
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  async billList({ id, offset = 0 }) {
    const { count, rows } = await this.ctx.model.Btcbill.findAndCountAll({
      limit: 30,
      where: { uid: id },
      offset,
      order: [["id", "desc"]],
    });
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  // 小姐列表
  async btcList({
    offset = 0,
    cityId,
    provinceId,
    categoryId,
    btcPass,
    up_uid,
    sTime,
    eTime,
  }) {
    const { ctx } = this.ctx
    const limit = 30;
    const criteria = {};
    // 把cont的数量存起来
    const countCategoryId = categoryId ? categoryId : 'all';
    const countName = 'btc-list-' + countCategoryId;
    if (cityId) criteria.cityId = cityId;
    if (provinceId) criteria.provinceId = provinceId;
    if (up_uid) criteria.up_uid = up_uid;
    if (categoryId) criteria.categoryId = categoryId;
    if (btcPass) criteria.btcPass = true;

    const redisPage = offset / limit + 1;
    const redisName = countName +'-'+redisPage;
    // const redisResponseData = await this.ctx.service.cache.get(redisName);
    let count = await this.ctx.model.Counters.findById(countName).select('seq').lean();
    // 异步存入文章条件的总数
    // let all_count = await this.ctx.model.Article.estimatedDocumentCount({status:0})
    this.ctx.model.Btc.countDocuments(criteria, (err, c) => {
      if (!count&&count!==0) {
        this.ctx.model.Counters.create({
          _id: countName,
          seq: c
        })
      } else if (count.seq !== c) {
        // 查询到的总数和当前的不一致更新总数
        this.ctx.model.Counters.updateOne({ _id: countName }, { $set: { seq: c } })
        // 清当前的文章Redis
        // this.ctx.service.cache.clearRedisKeyList(countName);
      }
    });
    // if (redisResponseData) {
    //   return redisResponseData;
    // }"image_list",
    let rows = await this.ctx.model.Btc.find(criteria).sort({"_id":-1}).skip(offset).limit(limit).select('title cityId provinceId image_list time createdAt tag overview view').lean()
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count: count&&count.seq?count.seq:1,
        limit,
        offset,
      },
    };
    // if(rows&&rows.length>0&&count.seq>1){
    //   this.ctx.service.cache.set(redisName, ResponseData);
    // }
    return ResponseData;
  }
  // 经纪人小姐列表
  async leaderBtcList({ offset = 0, leaderId }) {
    const { ctx } = this
    const limit = 30;
    const criteria = {};
    // 把cont的数量存起来
    //const countCategoryId = categoryId ? categoryId : 'all';
    const countName = 'btc-list-leader' + leaderId;
    // if (cityId) criteria.cityId = cityId;
    // if (provinceId) criteria.provinceId = provinceId;
    // if (up_uid) criteria.up_uid = up_uid;
    //if (categoryId) criteria.categoryId = categoryId;
    if (leaderId) criteria.leaderId = leaderId;

    const redisPage = offset / limit + 1;
    const redisName = countName +'-'+redisPage;
    // const redisResponseData = await this.ctx.service.cache.get(redisName);
    // let count = await ctx.model.Counters.findById(countName).select('seq').lean();
    // 异步存入文章条件的总数
    // let all_count = await ctx.model.Article.estimatedDocumentCount({status:0})
    let count = await ctx.model.BtcLeader.countDocuments(criteria, (err, c) => c);
    // if (redisResponseData) {
    //   return redisResponseData;
    // }"image_list",
    let rows = await ctx.model.BtcLeader.find(criteria).sort({"_id":-1}).skip(offset).limit(limit).select('title cityId provinceId time image_list createdAt tag overview view').lean()
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    return ResponseData;
  }
  // 添加
  async createBtcCategory(o) {
    // //验证
    // const user = await this.ctx.model.Btc.findById(this.ctx.session.uid);
    // if (user.alreadyBtcNum >= user.allowBtcNum) {
    //     return {
    //         message: '站点已达上限！',
    //         code: -1
    //     }
    // }
    // 验证重复
    const [btc, created] = await this.ctx.model.Btc.findOrCreate({
      where: {
        name: o.name,
      },
      defaults: {
        name: o.name,
        copyid: o.copyid,
        status: true,
      },
    });
    if (created) {
      // 设置alreadyBtcNum
      // console.log(user)
      // user.update({inventory: Sequelize.literal('inventory - 1')}, where: {XXX})
      // await user.increment('alreadyBtcNum', { by: 1 });
      return {
        message: "创建成功！",
        code: 200,
      };
    }
    // 已经存在
    return {
      message: "名称已存在",
      code: -2,
    };
  }

  async findBtc({ id, type }) {
    // 该用户是vip
    const isVip = this.ctx.service.utils.getTokenInfo("isVip");
    // console.log(isVip)
    const uid = this.ctx.service.utils.getTokenInfo("id");
    // options.attributes = { exclude: ['contact_information'] }
    let btc = null;
    if (type == 1) {
      btc = await this.ctx.model.Btc.findById(id);
    }
    if (type == 2) {
      btc = await this.ctx.model.BtcAwait.findById(id);
    }
    if (type == 3) {
      btc = await this.ctx.model.BtcLeader.findById(id);
    }

    if (!btc) {
      return { code: -2, message: "找不到！" };
    }
    if (btc.up_uid&&!isVip && type == 1&&uid !== btc.up_uid) {
      btc.contact_information=null;
      btc.noShowContact = 1
    }
    if (!isVip && type == 3&&uid !== btc.up_uid) {
      // 查看是否已经支付过
      // const isPay = await this.ctx.model.Btcpay.findOne({
      //   where: {
      //     userId: uid,
      //     btcId: id,
      //   },
      // });
      // // 非 vip 未支付 不是自己发布的 把联系方式删了----
      // 如果是用户发布的并且不是vip

      // if (uid !== btc.up_uid) {
        btc.contact_information=null;
        btc.noShowContact = 1
      // }
    }
    // await btc.update("view", { by: 1 });
    // btc.reload()
    let fivator = false;
    // if (uid) {
    //   // 是否被我收藏
    //   const BtcFivator = await this.ctx.model.BtcFivator.findOne({
    //     where: {
    //       btcId: id,
    //       userId: uid,
    //     },
    //   });
    //   if (BtcFivator) fivator = true;
    //   this.ctx.service.btc.history({ userId: uid, type: "add", btcId: id });
    // }
    return {
      code: 200,
      data: btc,
      fivator,
    };
  }
  // 收藏 取消收藏
  async fivator({ userId, type, btcId }) {
    if (type == "add") {
      await this.ctx.model.BtcFivator.create({
        userId,
        btcId,
      });
    } else {
      const BtcFivator = await this.ctx.model.BtcFivator.findOne({
        where: {
          userId,
          btcId,
        },
      });
      if (BtcFivator) {
        await BtcFivator.destroy();
      }
    }
    return { code: 200, message: "操作成功！" };
  }
  async fivatorList({ offset }) {
    // 收藏列表
    const userId = this.service.utils.getTokenInfo("id");
    const queryOptions = {
      offset,
      limit: 30,
      where: {
        userId,
      },
      order: [
        // ["createdAt", "desc"],
        ["id", "desc"],
      ],
      // attributes: { exclude: ['contact_information'] },
      include: [
        {
          model: this.ctx.model.Btc,
          attributes: ["id", "title", "image_list"],
        }, // 加载平台
      ],
    };

    const { count, rows } = await this.ctx.model.BtcFivator.findAndCountAll(
      queryOptions
    );
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  // 历史记录 取消历史记录
  async history({ userId, type, btcId }) {
    if (type == "add") {
      // 先检查是否已经存在
      const [history, created] = await this.ctx.model.BtcHistory.findOrCreate({
        where: {
          userId,
          btcId,
        },
        defaults: { userId, btcId, view: 1 },
      });
      // if (created === false && history) {
      //   history.increment('view');
      //   history.reload()
      // }
    } else {
      const BtcHistory = await this.ctx.model.BtcHistory.findOne({
        where: {
          userId,
          btcId,
        },
      });
      if (BtcHistory) {
        await BtcHistory.destroy();
      }
    }
    return { code: 200, message: "操作成功！" };
  }
  async historyList({ offset }) {
    // 收藏列表
    const userId = this.service.utils.getTokenInfo("id");
    const queryOptions = {
      offset,
      limit: 30,
      where: {
        userId,
      },
      order: [
        // ["createdAt", "desc"],
        ["updatedAt", "desc"],
      ],
      include: [
        {
          model: this.ctx.model.Btc,
          attributes: ["id", "title", "image_list"],
        }, // 加载平台
      ],
    };

    const { count, rows } = await this.ctx.model.BtcHistory.findAndCountAll(
      queryOptions
    );
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  // 支付一个小姐

  async updateBtc(id, updates) {
    const btc = await this.ctx.model.Btc.findById(id);
    if (!btc) {
      return { code: -2, message: "找不到！" };
    }
    await btc.update(updates);
    return { code: 200, message: "修改成功！" };
  }
  async disableBtc(id) {
    const btc = await this.ctx.model.Btc.findById(id);
    if (!btc) {
      return { code: -2, message: "站点找不到！" };
    }
    await btc.update({ status: !btc.status });
    // .destroy();
    return { code: 200, message: btc.name + "操作成功！" };
  }
  async delBtc(id) {
    const btc = await this.ctx.model.Btc.findById(id);
    await this.ctx.model.BtcDelete.create(btc.dataValues);
    await btc.destroy();
    return { code: 200, message: btc.name + "删除成功！" };
  }
  async checkBtcPassList({ offset, userId, isAdmin }) {
    // 待审核列表
    let whereSearch = {};
    if (!isAdmin) {
      whereSearch = {
        up_uid: userId,
      };
    }
    const queryOptions = {
      offset,
      limit: 30,
      where: whereSearch,
      order: [
        ["createdAt", "desc"],
        // ["updatedAt", "desc"],
      ],
    };
    const { count, rows } = await this.ctx.model.BtcAwait.findAndCountAll(
      queryOptions
    );
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  // 审核通过拒绝
  async checkBtcPass({ id, type, remarks }) {
    const btcInfo = await this.ctx.model.BtcAwait.findById(id);
    if (!btcInfo.status)
      return { code: -2, message: "已经审核过，无需审核！" };
    if (btcInfo) {
      if (type == "pass") {
        await this.ctx.model.Btc.create(btcInfo.dataValues);
        const up_userinfo = await this.ctx.model.BtcUser.findById(
          btcInfo.up_uid
        );
        // 增加2金币 增加经验100
        await up_userinfo.increment({
          coin: 2,
          exp: 100,
        });
        // await up_userinfo.increment("coin", { by: 1 });

        await btcInfo.destroy();
      } else {
        await btcInfo.update({
          status: false,
          remarks: remarks || "-",
        });
        await btcInfo.reload();
      }
      return { code: 200, message: "操作成功！", data: btcInfo || {} };
    }
    return { code: -2, message: "你没资格审核！" };
  }
  async createBtc({ saveData, up_uid, up_username }) {
    // 保存到数据库的操作 视频地址和图片不能为空
    const btcInfo = {
      title: saveData.title,
      up_uid,
      up_username,
      btcType: saveData.btcType,
      figure: saveData.figure,
      num: saveData.num,
      btcPass: 0,
      type: 1,
      pay_view: 0,
      job: saveData.job,
      overview: saveData.overview,
      copyid: "0",
      isShowInfoContent: 0,
      provinceId: saveData.provinceId,
      cityId: saveData.cityId,
      star: 0,
      bad: 0,
      view: 0,
      status: 1,
      time: new Date().toLocaleString(),
      isHot: 0,
      isTop: 0,
      image_list: saveData.image_list,
      video_list: saveData.video_list,
      categoryId: saveData.categoryId,
      price: saveData.price,
      contact_information: saveData.contact_information,
      service: saveData.service,
      environment: saveData.environment,
      service_time: saveData.service_time,
      safety_assessment: saveData.safety_assessment,
      age: saveData.age,
      bust: saveData.bust,
      info_from: saveData.info_from,
      detail_address: saveData.detail_address,
      content: saveData.content,
    };
    if (saveData.createType == 1) {
      await this.ctx.model.BtcAwait.create(btcInfo);
    } else if (saveData.createType == 2) {
      await this.ctx.model.BtcLeader.create({
        ...btcInfo,
        leaderId: saveData.leaderId,
        leaderUserName: saveData.leaderUserName,
      });
    }
    return { code: 200, message: "添加成功！" };
  }

  async checkBtcName({ title }) {
    // 如果待审核列表中超过五个自己上传未审核的-则不能发布
    const userId = this.service.utils.getTokenInfo("id");
    let count = await this.ctx.model.BtcAwait.count({
      where: {
        up_uid: userId,
      },
    });
    if (count >= 5)
      return { code: -2, message: "有过多待审核内容，请耐心等待！" };
    const btcInfo = await this.ctx.model.Btc.findOne({
      where: {
        title,
      },
    });
    if (btcInfo && btcInfo.id) {
      return { code: 200, data: 1 };
    } else {
      return { code: 200, data: 0 };
    }
  }
  async commentBtcList({ btcId, offset }) {
    const isAdmin = this.service.utils.getTokenInfo("isAdmin");
    const uid = this.service.utils.getTokenInfo("id");
    // let {ctx} = this.ctx
    let options = {};
    if (btcId) {
      // 小姐评论
      options.btcId = btcId - 0;
      options.status = 1;
      // options.uid = uid
    }
    if (!isAdmin && !btcId) {
      // 评论总列表
      options.uid = uid;
    }
    // let countName = 'btc-comments-btc-'+btcId
    // const redisResponseData = await this.ctx.service.cache.get(redisName);
    // let count = await ctx.model.Counters.findById(countName).select('seq').lean();
    // 异步存入文章条件的总数
    let count = 0
    await this.ctx.model.BtcComment.countDocuments({
      options
    }, (err, c) => {
      count = c
    });
    
    const rows = await this.ctx.model.BtcComment.find({
      options
    }).sort().lean()

    // const { count, rows } = await this.ctx.model.BtcComment.findAndCountAll({
    //   limit: 30,
    //   where: options,
    //   offset,
    //   order: [
    //     ["isTop", "asc"],
    //     ["id", "desc"],
    //   ],
    // });


    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit: 30,
        offset,
      },
    };
    return ResponseData;
  }
  async createBtcComment({ btcId, content, btcTitle }) {
    // vip 可以添加评论
    const isVip = this.service.utils.getTokenInfo("isVip");
    const uid = this.service.utils.getTokenInfo("id");
    const username = this.service.utils.getTokenInfo("username");
    if (!isVip) return { code: -2, message: "不符合评论条件！" };
    if (!content || content.length < 5 || content.length > 500) {
      return { code: -2, message: "评论长度不符合！" };
    }
    let myCommentNum = await this.ctx.model.BtcComment.count({
      where: {
        btcId,
        uid,
        status: 0,
      },
    });
    if (myCommentNum >= 3) {
      return { code: -2, message: "❌❌请等待审核后评论！❌❌" };
    }
    await this.ctx.model.BtcComment.create({
      uid,
      btcId,
      content,
      status: 0,
      star: 0,
      bad: 0,
      isTop: false,
      isHot: false,
      nickname: username,
      btcTitle,
    });
    return { code: 200, message: "评论成功❤️❤️-等待审核！" };
  }
  async updateBtcComment({ id, type }) {
    const isAdmin = this.service.utils.getTokenInfo("isAdmin");
    let comment = await this.ctx.model.BtcComment.findByPk(id);
    if (type == "top" && isAdmin) {
      await comment.update({
        isTop: !comment.isTop,
      });
    }
    if (type == "pass" && isAdmin) {
      await comment.update({
        status: 1,
      });
    }
    if (type == "noPass" && isAdmin) {
      await comment.update({
        status: 2,
      });
    }
    if (type == "hot" && isAdmin) {
      await comment.update({
        isTop: !comment.isTop,
      });
    }
    if (type == "star") {
      await comment.increment("star", { by: 1 });
    }
    if (type == "bad") {
      await comment.increment("bad", { by: 1 });
    }
    await comment.reload();
    const ResponseData = {
      code: 200,
      data: comment,
    };
    return ResponseData;
  }
  async delBtcComment({ id }) {
    const isAdmin = this.service.utils.getTokenInfo("isAdmin");
    if (!isAdmin) return { code: -2, message: "无权限！" };
    let comment = await this.ctx.model.BtcComment.findByPk(id);
    await comment.destroy();
    return { code: 200, message: "删除成功！" };
  }
}

module.exports = BtcService;
