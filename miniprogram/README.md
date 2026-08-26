# 情绪日历小程序版（uni-app + Vue3）

把网页版情绪日历改造成 uni-app 小程序：界面用 Vue 重写，后端直接复用 `/api/analyze`
（多模型切换、JSON 模式、重试、限流全在后端，一行不用改）。

## 运行步骤

1. 下载并安装 **HBuilderX**：https://www.dcloud.io/hbuilderx.html
2. 下载并安装**微信开发者工具**：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
3. 用 HBuilderX 打开本项目文件夹：文件 → 导入 → 从本地目录导入
4. 菜单：运行 → 运行到小程序模拟器 → 微信开发者工具
5. 首次运行会提示选择微信开发者工具的安装路径，选一下即可

> 如果请求失败：在微信开发者工具里点「详情 → 本地设置」，勾选
> "不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"。

## 目录结构

```
miniprogram/
├── pages.json         # 页面路由配置（新页面必须在这里注册）
├── manifest.json      # 应用配置（名称、小程序 appid 等）
├── App.vue            # 应用级组件（全局样式 + 启动生命周期）
├── main.js            # 入口文件，创建应用实例
├── config.js          # API 地址配置（切换线上/本地）
├── utils/
│   └── api.js         # 调 /api/analyze 的封装（uni.request）
└── pages/
    └── index/
        └── index.vue  # 首页：日历 + 记录弹窗 + 月度统计
```

## 配置 API 地址

默认用线上 Netlify 地址（见 `config.js`）。本地调试可改成
`http://localhost:8888`（先在项目根目录运行 `netlify dev`）。

## 和后端的关系

小程序不直接调 DeepSeek，而是调用和网页版相同的 `/api/analyze`——
API Key 仍然只存在服务端环境变量里，安全设计不变。
