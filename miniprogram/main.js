// uni-app 入口文件：创建应用实例
// 每个 uni-app 项目都有这个文件，作用相当于网页版的"启动脚本"
import App from './App.vue';
import { createSSRApp } from 'vue';

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
