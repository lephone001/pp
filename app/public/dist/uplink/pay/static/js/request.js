// 独立令牌，不读取或清理主后台 Admin-Token。
const request = async function ({ url, method = 'POST', data = {} }) {
    if (!url) throw new Error('参数错误！');
    const token = localStorage.getItem('UPLINK_TOKEN');
    const headers = token ? { Authorization: token } : {};
    const res = await axios({ method, url, headers, data });
    if (res.data.code == 200) return res.data.data;
    if (res.data.code == -4) {
        localStorage.removeItem('UPLINK_TOKEN');
        window.location.href = './login.html';
    } else {
        alert(res.data.message || '请求失败！');
    }
    throw res.data;
};
