'use strict';
const cheerio = require('cheerio');
// Conservative editorial filter, not a semantic classifier. Check visible text, not URLs or markup.
const excluded = /政治|时政|時政|民生|社会新闻|社會新聞|国际局势|國際局勢|外交部|国务院|國務院|全国人大|全國人大|政协|政協|两会|兩會|共产党|共產黨|民主党|民主黨|共和党|共和黨|总统|總統|总理|總理|议会|議會|选举|選舉|竞选|競選|俄乌|俄烏|巴以|台海|军事演习|軍事演習|关税|關稅|医保|醫保|社保|养老金|養老金|退休年龄|退休年齡|低保|住房公积金|住房公積金|房贷|房貸|楼市|樓市|房价|房價|高考|中考|招生政策|失业率|失業率|最低工资|最低工資|交通事故|车祸|車禍|伤亡|傷亡|遇难|遇難|命案|刑事|警方通报|警方通報|电信诈骗|電信詐騙|地震|洪灾|洪災|暴雨预警|暴雨預警|台风预警|颱風預警/;
function exclusionReason(item) {
  const title = String(item.title || '');
  const body = cheerio.load(String(item.content || item.description || '').slice(0, 500000)).text();
  if (excluded.test(title + '\n' + body)) return '政治、民生或社会新闻';
  const han = (title.match(/[\u3400-\u9fff]/g) || []).length;
  const letters = (title.match(/[a-z\u3400-\u9fff]/gi) || []).length;
  const bodyHan = (body.match(/[\u3400-\u9fff]/g) || []).length;
  if (han < 2 || (han / Math.max(letters, 1) < 0.2 && bodyHan < 20)) return '非中文文章';
  return '';
}
module.exports = { exclusionReason };
