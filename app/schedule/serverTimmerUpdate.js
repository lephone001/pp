const Subscription = require('egg').Subscription;
const fs = require('fs');
const os = require('os');

const axios = require('axios')

function isPrivateIpv4(ip) {
  return /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(ip)
    || /^169\.254\./.test(ip);
}

function getServerIp() {
  // 有公网 IP 或指定出口 IP 时可显式配置，避免 NAT 环境只能取得内网 IP。
  const configuredIp = String(process.env.SERVER_IP || '').trim();
  if (configuredIp) return configuredIp;

  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(interfaces).forEach(name => {
    (interfaces[name] || []).forEach(item => {
      const isIpv4 = item && (item.family === 'IPv4' || item.family === 4);
      if (isIpv4 && !item.internal && item.address) {
        addresses.push(item.address);
      }
    });
  });

  // 公网地址优先；没有公网网卡时使用第一个非回环内网地址。
  return addresses.find(ip => !isPrivateIpv4(ip)) || addresses[0] || '127.0.0.1';
}

function getServerDisplayName() {
  // SERVER_DISPLAY_NAME 可设置为“香港服务器01”等容易识别的名称。
  const configuredName = String(process.env.SERVER_DISPLAY_NAME || '').trim();
  if (configuredName) return configuredName;

  const hostname = String(os.hostname() || '服务器').trim();
  let machineId = '';
  const machineIdFiles = ['/etc/machine-id', '/var/lib/dbus/machine-id'];

  for (let i = 0; i < machineIdFiles.length; i += 1) {
    try {
      machineId = fs.readFileSync(machineIdFiles[i], 'utf8').trim();
      if (machineId) break;
    } catch (error) {
      // 某些精简 Linux 系统没有 machine-id，继续使用主机名兜底。
    }
  }

  return hostname + (machineId ? `-${machineId.slice(0, 8)}` : '');
}

class GetVideoData extends Subscription {
    // 通过 schedule 属性来设置定时任务的执行间隔等配置
    static get schedule () {
        return {
          cron: '0 0 6,19 * * ?',//凌晨4点和晚上8点
          type: 'worker', // 指定所有的 worker 都需要执行
        };
      }
    async subscribe(ctx) {
        //更新app
        await this.ctx.service.app.updateAppCacheList();
        //更新文章
        await this.ctx.service.article.updateArticleCacheList();
        const serverIp = getServerIp();
        const serverDisplayName = getServerDisplayName();
        const resMessage = `服务器名称：${serverDisplayName}\n服务器IP：${serverIp}\n已经更新！`;

                
        if (process.env.NODE_ENV === 'production') {
          await axios({
            method: 'post',
            url: `https://api.telegram.org/bot6823418655:AAFw5144tZV__oqQbw3IB2mRCssm24oUtuE/sendMessage`,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'curl/7.12.1'
            },
            data: {
                chat_id:"-1002337053977",
                text:resMessage
            }
          }).then(res => {}).catch(error => {})
        }
        //生成文章js
        await this.ctx.service.autoArticle.createArticleJs()
    }
}

module.exports = GetVideoData;
