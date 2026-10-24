// 220.181.108.0/24
// 220.181.112.0/24
// 123.125.71.0/24
// 119.63.224.0/20
// 23.125.68.*这个蜘蛛经常来,别的来的少,表示网站可能要进入沙盒了，或被者降权。
// 220.181.68.*每天这个IP 段只增不减很有可能进沙盒或K站。
// 220.181.7.*、123.125.66.* 代表百度蜘蛛IP造访，准备抓取你东西。
// 121.14.89.*这个ip段作为度过新站考察期。
// 203.208.60.*这个ip段出现在新站及站点有不正常现象后。
// 210.72.225.*这个ip段不间断巡逻各站。
// 125.90.88.* 广东茂名市电信也属于百度蜘蛛IP 主要造成成分，是新上线站较多，还有使用过站长工具，或SEO综合检测造成的。
// 220.181.108.95这个是百度抓取首页的专用IP，如是220.181.108段的话，基本来说你的网站会天天隔夜快照，绝对错不了的，我保证。
// 220.181.108.92 同上98%抓取首页，可能还会抓取其他 (不是指内页)220.181段属于权重IP段此段爬过的文章或首页基本24小时放出来。
// 123.125.71.106 抓取内页收录的，权重较低，爬过此段的内页文章不会很快放出来，因不是原创或采集文章。
// 220.181.108.91属于综合的，主要抓取首页和内页或其他，属于权重IP 段，爬过的文章或首页基本24小时放出来。
// 220.181.108.75重点抓取更新文章的内页达到90%，8%抓取首页，2%其他。权重IP 段，爬过的文章或首页基本24小时放出来。
// 220.181.108.86专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 123.125.71.95 抓取内页收录的，权重较低，爬过此段的内页文章不会很快放出来，因不是原创或采集文章。
// 123.125.71.97 抓取内页收录的，权重较低，爬过此段的内页文章不会很快放出来，因不是原创或采集文章。
// 220.181.108.89专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 220.181.108.94专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 220.181.108.97专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 220.181.108.80专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 220.181.108.77 专用抓首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 123.125.71.117 抓取内页收录的，权重较低，爬过此段的内页文章不会很快放出来，因不是原创或采集文章。
// 220.181.108.83专用抓取首页IP 权重段，一般返回代码是304 0 0 代表未更新。
// 百度蜘蛛ip 参照
const spliderListBlock = [
    "aemrushbot",
    "mj12bot",
    "ahrefsbot",
    "hubspot",
    "opensiteexplorer",
    "leiki",
    "webmeup",
    "googlebot",
    "googlebot-mobile",
    "bingbot",
    "yahoo",
    "msnbot",
    "youdaobot",
    "facebook",
    "sosospider",
    "yahoo",
    "yisouspider",
    "easouspider",
    "etaospider",
    "163data.com",
    "amazonaws.com",
    "amazonbot",
    "bytespider",
    "google",
    "Bytespider",
    "python",
    "Amazonbot",
    "amazonbot",
    "SemrushBot",
    "MJ12bot",
    "AhrefsBot",
    "hubspot",
    "opensiteexplorer",
    "leiki",
    "webmeup",
    "Googlebot",
    "Googlebot-Mobile",
    "Yahoo",
    "MSNBot",
    "msnbot",
    "YoudaoBot",
    "DeepSeek",
    "deepseek",
    "GPTBot",
    "gptbot",
]
const blackIpList = [
    '47.79.',
    "66.249.",
    '47.82.',
    // "183.207.45.",
    // "183.207.48.",
    // "36.99.136.",
    // "111.7.100.",
    // "17.241.75.",
    // "17.241.227.",
    // "69.171.249.",
    // "69.171.230.",
    // "101.91.136.",
    // "101.91.134.",
    // "101.91.135.",
    // "101.91.133.",
    // "20.171.206.",
    // "110.249.202.",
    // "112.65.212.",
    // '114.228.196.81',
    // '218.93.78.236',
    // '183.207.45.126',
    // '183.134.59.131',
    // '183.207.45.',
    // '183.207.48.',
    // '122.96.30.65',
   
    // //谷歌蜘蛛s
    // '47.237.',
    // '8.219.',
    // "35.202.2.",
    // "35.239.58.",
    // "57.141.3.",
    // "78.128.114.0/24",
    // "57.141.3.0/24",
    // "101.206.58.",
    // "101.206.57.",
    // "101.206.52.",
    // "101.206.235.",
    // "101.91.133.",
    // "101.91.133.",
    // "101.91.135.",
    // "117.68.7.",
    // "117.68.0.",
    // "101.91.133.",
    // "101.91.134.",
    // //谷歌蜘蛛e
    // "47.128.60.121",
    // "47.128.61.149",
    // "47.128.35.213",
    // "47.128.22.124",
    // "47.128.19.227",
    // "47.128.62.39",
    // "47.128.19.62",
    // "47.128.55.186",
    // "47.128.60.77",
    // "47.128.22.15",
    // "47.128.31.251",
    // "52.41.245.253",
    // "123.58.215.254",
    // "123.58.220.111",
    // "101.91.134.89",
    // "101.91.136.240",
    // "221.180.206.245",
    // "47.128.17.48",
    // "111.7.106.104",
    // "111.7.106.105",
    // "173.252.83.",
    // "173.252.107.",
    // "36.150.60.24",
    // "114.228.196.81",
    // "218.93.78.236",
    // "153.101.64.39",
    // "58.34.1.192",
    // "58.49.150.210",
    // "111.170.14.76",
    // "180.175.163.9",
    // "221.180.206.132",
    // "221.180.206.249",
    // "218.60.148.253",
    // "183.129.153.150",
    // "129.227.150.140",
    // "35.92.82.225",
    // "52.90.219.236",
    // "183.162.252.243",
    // "180.175.163.9",
    // "182.46.235.138",
    // "124.132.236.211",
    // "211.90.249.152",
    // "171.115.183.172",
    // "59.57.203.61",
    // "112.96.50.200",
    // "36.106.78.117",
    // "119.177.232.77",
    // "119.123.40.114",
    // "103.186.109.185",
    // "183.232.208.229",
    // "39.184.38.203",
    // "121.63.189.245",
    // "114.217.103.10",
    // "223.106.0.146",
    // "112.42.62.245",
    // "183.212.150.106",
    // "120.243.159.134",
    // "49.86.254.50",
    // "27.27.233.78",
    // "111.58.105.57",
    // "183.228.187.156",
    // "183.198.95.107",
    // "183.252.251.181",
    // "36.150.60.24",
    // "117.183.131.10",
    // "120.243.220.201",
    // "112.39.88.107",
    // "39.128.51.5",
    // "43.243.102.2",
    // "43.243.102.3",
    // "103.150.11.55",
    // "218.22.62.13",
    // "57.141.3.13",
    // "113.207.49.92",
    // "103.150.11.55",
    // "61.136.232",
    // "111.180.191",
    // "54.186.216.162",
    // "205.169.39.17",
    // "185.220.100.240",
    // "185.220.101.32",
    // "185.40.4.95",
    // "58.144.138.11",
    // "113.207.105.200",
    // "182.16.89.90", 
    // "110.40.37.248",
    // "103.150.11.3",
    // "122.228.19.79",
    // "216.172.137.42",
    // "58.49.146.74",
    // "171.107.12.27",
    // "103.109.101.75",
    // "123.6.49.44",                                                                   
    // "123.6.49.15",
    // "123.6.49.12",
    // "123.6.49.50",
    // "123.6.49.47",
    // "123.6.49.18",
    // "27.115.124.6",
    // "27.115.124.38",
    // "27.115.124.70",
    // "27.115.124.53",
    // "27.115.124.109",
    // "27.115.124.101",
    // "27.115.124.45",
    // "27.115.124.118",
    // "36.137.216.31",
    // "36.137.216.32",
    // "36.137.216.33",
    // "36.137.216.34",
    // "36.137.216.35",
    // "36.137.216.36",
    // "36.137.216.37",
    // "221.180.206.71",
    // "91.239.130.201",
    // "52.178.219.51",
    // "112.65.211.214",
    // "112.65.211.194",
    // "112.65.212.199",
    // "112.65.211.78",
    // "112.65.211.199",
    // "112.65.211.164",
    // "112.65.212.225",
    // "112.65.211.239",
    // "112.65.211.251",
    // "112.65.211.239",
    // "117.63.120.82",
    // "114.226.1.70",
    // "221.180.206.15",
    // "60.190.226.179",
    // "154.39.123.167",
    // "217.160.14.153",
    // "140.206.235.",
    // "140.206.236.",
    // "121.229.14.62",
    // "115.231.78.4",
    // "110.249.202.",
    // "110.249.201.",
    // "111.225.149.",
    // "111.225.148.",


// iptables -I INPUT -s 121.237.118.81 -j DROP
// iptables -I INPUT -s 113.237.184.170 -j DROP
// iptables -I INPUT -s 42.6.177.192 -j DROP
// iptables -I INPUT -s 114.233.8.159 -j DROP
// iptables -I INPUT -s 117.69.159.29 -j DROP
// iptables -I INPUT -s 218.91.71.10 -j DROP
// iptables -I INPUT -s 36.26.119.19 -j DROP
// iptables -I INPUT -s 114.230.79.180 -j DROP
// iptables -I INPUT -s 183.141.45.206 -j DROP
// iptables -I INPUT -s 114.219.55.65 -j DROP
// iptables -I INPUT -s 183.166.171.202 -j DROP
// iptables -I INPUT -s 218.6.104.10 -j DROP
// iptables -I INPUT -s 183.166.137.20 -j DROP
// iptables -I INPUT -s 114.233.8.2 -j DROP
// iptables -I INPUT -s 183.166.171.39 -j DROP
// iptables -I INPUT -s 61.154.54.52 -j DROP
// iptables -I INPUT -s 112.194.91.17 -j DROP
// iptables -I INPUT -s 119.102.157.172 -j DROP
// iptables -I INPUT -s 59.60.210.17 -j DROP
// iptables -I INPUT -s 49.68.6.159 -j DROP
// iptables -I INPUT -s 49.69.74.20 -j DROP
// iptables -I INPUT -s 223.243.192.67 -j DROP
// iptables -I INPUT -s 180.119.92.184 -j DROP
// iptables -I INPUT -s 49.85.188.3 -j DROP
// iptables -I INPUT -s 114.218.62.249 -j DROP
// iptables -I INPUT -s 112.194.192.134 -j DROP
// iptables -I INPUT -s 49.85.188.144 -j DROP
// iptables -I INPUT -s 183.141.64.228 -j DROP
// iptables -I INPUT -s 183.141.178.177 -j DROP
// iptables -I INPUT -s 112.194.88.4 -j DROP
// iptables -I INPUT -s 114.232.122.234 -j DROP
// iptables -I INPUT -s 114.233.8.193 -j DROP
// iptables -I INPUT -s 110.184.203.80 -j DROP
// iptables -I INPUT -s 101.206.57.79 -j DROP
// iptables -I INPUT -s 118.113.219.253 -j DROP
// iptables -I INPUT -s 182.107.177.185 -j DROP
// iptables -I INPUT -s 125.123.84.8 -j DROP

//----------------必要时直接运行---
/*
iptables -I INPUT -s 183.207.45.0/24 -j DROP
iptables -I INPUT -s 183.207.48.0/24 -j DROP
iptables -I INPUT -s 36.99.136.0/24 -j DROP
iptables -I INPUT -s 111.7.100.0/24 -j DROP
iptables -I INPUT -s 17.241.75.0/24 -j DROP
iptables -I INPUT -s 17.241.227.0/24 -j DROP
iptables -I INPUT -s 69.171.249.0/24 -j DROP
iptables -I INPUT -s 69.171.230.0/24 -j DROP
iptables -I INPUT -s 101.91.136.0/24 -j DROP
iptables -I INPUT -s 101.91.134.0/24 -j DROP
iptables -I INPUT -s 101.91.135.0/24 -j DROP
iptables -I INPUT -s 101.91.133.0/24 -j DROP
iptables -I INPUT -s 20.171.206.0/24 -j DROP
iptables -I INPUT -s 35.202.2.0/24 -j DROP
iptables -I INPUT -s 35.239.58.0/24 -j DROP
iptables -I INPUT -s 66.249.71.0/24 -j DROP
iptables -I INPUT -s 66.249.72.0/24 -j DROP
iptables -I INPUT -s 66.249.73.0/24 -j DROP
iptables -I INPUT -s 66.249.74.0/24 -j DROP
iptables -I INPUT -s 66.249.75.0/24 -j DROP
iptables -I INPUT -s 66.249.76.0/24 -j DROP
iptables -I INPUT -s 66.249.77.0/24 -j DROP
iptables -I INPUT -s 66.249.78.0/24 -j DROP
iptables -I INPUT -s 66.249.79.0/24 -j DROP
iptables -I INPUT -s 66.249.66.0/24 -j DROP
iptables -I INPUT -s 117.68.7.0/24 -j DROP
iptables -I INPUT -s 117.68.0.0/24 -j DROP
iptables -I INPUT -s 173.252.83.0/24 -j DROP
iptables -I INPUT -s 61.136.232.0/24 -j DROP
iptables -I INPUT -s 111.180.191.0/24 -j DROP
iptables -I INPUT -s 173.252.107.0/24 -j DROP
iptables -I INPUT -s 20.171.206.0/24 -j DROP
iptables -I INPUT -s 52.41.245.253 -j DROP
iptables -I INPUT -s 123.58.215.254 -j DROP
iptables -I INPUT -s 123.58.220.111 -j DROP
iptables -I INPUT -s 101.91.134.89 -j DROP
iptables -I INPUT -s 101.91.136.240 -j DROP
iptables -I INPUT -s 221.180.206.245 -j DROP
iptables -I INPUT -s 47.128.17.48 -j DROP
iptables -I INPUT -s 111.7.106.104 -j DROP
iptables -I INPUT -s 111.7.106.105 -j DROP
iptables -I INPUT -s 36.150.60.24 -j DROP
iptables -I INPUT -s 114.228.196.81 -j DROP
iptables -I INPUT -s 218.93.78.236 -j DROP
iptables -I INPUT -s 153.101.64.39 -j DROP
iptables -I INPUT -s 58.34.1.192 -j DROP
iptables -I INPUT -s 58.49.150.210 -j DROP
iptables -I INPUT -s 111.170.14.76 -j DROP
iptables -I INPUT -s 180.175.163.9 -j DROP
iptables -I INPUT -s 221.180.206.132 -j DROP
iptables -I INPUT -s 221.180.206.249 -j DROP
iptables -I INPUT -s 218.60.148.253 -j DROP
iptables -I INPUT -s 47.128.60.121 -j DROP
iptables -I INPUT -s 47.128.61.149 -j DROP
iptables -I INPUT -s 47.128.35.213 -j DROP
iptables -I INPUT -s 47.128.22.124 -j DROP
iptables -I INPUT -s 47.128.19.227 -j DROP
iptables -I INPUT -s 47.128.62.39 -j DROP
iptables -I INPUT -s 47.128.19.62 -j DROP
iptables -I INPUT -s 47.128.55.186 -j DROP
iptables -I INPUT -s 47.128.60.77 -j DROP
iptables -I INPUT -s 47.128.22.15 -j DROP
iptables -I INPUT -s 47.128.31.251 -j DROP
iptables -I INPUT -s 183.129.153.150 -j DROP
iptables -I INPUT -s 129.227.150.140 -j DROP
iptables -I INPUT -s 35.92.82.225 -j DROP
iptables -I INPUT -s 52.90.219.236 -j DROP
iptables -I INPUT -s 183.162.252.243 -j DROP
iptables -I INPUT -s 180.175.163.9 -j DROP
iptables -I INPUT -s 182.46.235.138 -j DROP
iptables -I INPUT -s 124.132.236.211 -j DROP
iptables -I INPUT -s 211.90.249.152 -j DROP
iptables -I INPUT -s 171.115.183.172 -j DROP
iptables -I INPUT -s 59.57.203.61 -j DROP
iptables -I INPUT -s 112.96.50.200 -j DROP
iptables -I INPUT -s 36.106.78.117 -j DROP
iptables -I INPUT -s 119.177.232.77 -j DROP
iptables -I INPUT -s 119.123.40.114 -j DROP
iptables -I INPUT -s 103.186.109.185 -j DROP
iptables -I INPUT -s 183.232.208.229 -j DROP
iptables -I INPUT -s 39.184.38.203 -j DROP
iptables -I INPUT -s 121.63.189.245 -j DROP
iptables -I INPUT -s 114.217.103.10 -j DROP
iptables -I INPUT -s 223.106.0.146 -j DROP
iptables -I INPUT -s 112.42.62.245 -j DROP
iptables -I INPUT -s 183.212.150.106 -j DROP
iptables -I INPUT -s 120.243.159.134 -j DROP
iptables -I INPUT -s 49.86.254.50 -j DROP
iptables -I INPUT -s 27.27.233.78 -j DROP
iptables -I INPUT -s 111.58.105.57 -j DROP
iptables -I INPUT -s 183.228.187.156 -j DROP
iptables -I INPUT -s 183.198.95.107 -j DROP
iptables -I INPUT -s 183.252.251.181 -j DROP
iptables -I INPUT -s 36.150.60.24 -j DROP
iptables -I INPUT -s 117.183.131.10 -j DROP
iptables -I INPUT -s 120.243.220.201 -j DROP
iptables -I INPUT -s 112.39.88.107 -j DROP
iptables -I INPUT -s 39.128.51.5 -j DROP
iptables -I INPUT -s 43.243.102.2 -j DROP
iptables -I INPUT -s 43.243.102.3 -j DROP
iptables -I INPUT -s 103.150.11.55 -j DROP
iptables -I INPUT -s 218.22.62.13 -j DROP
iptables -I INPUT -s 57.141.3.13 -j DROP
iptables -I INPUT -s 113.207.49.92 -j DROP
iptables -I INPUT -s 103.150.11.55 -j DROP
iptables -I INPUT -s 54.186.216.162 -j DROP
iptables -I INPUT -s 205.169.39.17 -j DROP
iptables -I INPUT -s 185.220.100.240 -j DROP
iptables -I INPUT -s 185.220.101.32 -j DROP
iptables -I INPUT -s 185.40.4.95 -j DROP
iptables -I INPUT -s 58.144.138.11 -j DROP
iptables -I INPUT -s 113.207.105.200 -j DROP
iptables -I INPUT -s 182.16.89.90 -j DROP 
iptables -I INPUT -s 110.40.37.248 -j DROP
iptables -I INPUT -s 103.150.11.3 -j DROP
iptables -I INPUT -s 122.228.19.79 -j DROP
iptables -I INPUT -s 216.172.137.42 -j DROP
iptables -I INPUT -s 58.49.146.74 -j DROP
iptables -I INPUT -s 171.107.12.27 -j DROP
iptables -I INPUT -s 103.109.101.75 -j DROP
iptables -I INPUT -s 123.6.49.44 -j DROP
iptables -I INPUT -s 123.6.49.15 -j DROP
iptables -I INPUT -s 123.6.49.12 -j DROP
iptables -I INPUT -s 123.6.49.50 -j DROP
iptables -I INPUT -s 123.6.49.47 -j DROP
iptables -I INPUT -s 123.6.49.18 -j DROP
iptables -I INPUT -s 27.115.124.6 -j DROP
iptables -I INPUT -s 27.115.124.38 -j DROP
iptables -I INPUT -s 27.115.124.70 -j DROP
iptables -I INPUT -s 27.115.124.53 -j DROP
iptables -I INPUT -s 27.115.124.109 -j DROP
iptables -I INPUT -s 27.115.124.101 -j DROP
iptables -I INPUT -s 27.115.124.45 -j DROP
iptables -I INPUT -s 27.115.124.118 -j DROP
iptables -I INPUT -s 36.137.216.31 -j DROP
iptables -I INPUT -s 36.137.216.32 -j DROP
iptables -I INPUT -s 36.137.216.33 -j DROP
iptables -I INPUT -s 36.137.216.34 -j DROP
iptables -I INPUT -s 36.137.216.35 -j DROP
iptables -I INPUT -s 36.137.216.36 -j DROP
iptables -I INPUT -s 36.137.216.37 -j DROP
iptables -I INPUT -s 221.180.206.71 -j DROP
iptables -I INPUT -s 91.239.130.201 -j DROP
iptables -I INPUT -s 52.178.219.51 -j DROP
*/
//----------------必要时直接运行---


    // "127.0.0.1"
    // 207.46.13
    // 52.167.144
    // 20.15.133
    // 40.77.167
    // 157.55.39
    // 17.241.75
    // 17.241.227
    // 52.167.144
    // 207.241.235
]
const whiteIpList = [

]
const whiteDomainList = [
    
] 
module.exports = {spliderListBlock,blackIpList,whiteDomainList}