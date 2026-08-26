// 调后端 /api/analyze 的封装（对应网页版里的 fetch）
// uni.request 是 uni-app 的统一网络请求 API，小程序 / App / H5 都能用
import config from '../config.js';

export function analyzeMood(text) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: config.apiBaseUrl + '/api/analyze',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { text },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error((res.data && res.data.error) || `请求失败（${res.statusCode}）`));
        }
      },
      fail() {
        reject(new Error('网络请求失败，请检查网络'));
      }
    });
  });
}
