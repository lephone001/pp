'use strict';
const Service = require('egg').Service;
const CryptoJS = require('crypto-js');
const keycode = 'jiamibijibenkey-123';
class UplinkUtils extends Service {
  jiamiFn(datac) {
    let casd = datac
    if (typeof casd !== 'string') {
      casd = JSON.stringify(casd)
    }
    let content = CryptoJS.AES.encrypt(
      casd,
      keycode
    ).toString();
    return content;
  }
  jiemiFn(datac) {
    let casd = datac
    let isString = 1
    if (typeof datac !== 'string') {
      casd = JSON.stringify(casd)
      isString = 0
    }
    let bytes = CryptoJS.AES.decrypt(casd, keycode);
    let originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (isString == 1) {
      try{
        originalText = JSON.parse(originalText)
      }catch{
      }
    }
    return originalText
  }
}
module.exports = UplinkUtils;
