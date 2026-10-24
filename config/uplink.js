'use strict';

// Uplink authentication and sync source are independent of the main admin.
module.exports = {
  jwtSecret: process.env.UPLINK_JWT_SECRET || "hmg_video_one",
  // 默认从发起更新的服务 /html/ 获取文件；仅在需指定公网地址时覆盖。
  updateSource: process.env.UPLINK_UPDATE_SOURCE || '',
};
