
# 情绪日历 Mood Calendar

一个基于 AI 的情绪追踪与可视化日历应用，帮助你记录每日心情，追踪情绪变化。

🌐 **在线体验：** https://famous-torrone-d909fb.netlify.app/

---

## ✨ 功能特点

- 📅 **日历视图** — 直观展示每日情绪状态，支持月份切换
- 🤖 **AI 情绪分析** — 输入文字描述，AI 自动识别情绪（开心 / 普通 / 难过）
- 📊 **数据可视化** — 每月情绪统计图表（Chart.js），清晰看见情绪趋势
- 💬 **语录推荐** — 根据情绪状态推送名人名言，温暖陪伴
- 📱 **响应式设计** — 支持移动端访问，随时随地记录

---

## 🛠 技术栈

### 前端

- **核心：** 原生 HTML5、CSS3、JavaScript (ES6)
- **特点：** 无框架，纯手工实现 DOM 操作、事件绑定、日历渲染和 localStorage 存储

### 后端与 API

- **后端形式：** Netlify Functions (Serverless 函数)
- **作用：** 作为安全代理，转发前端请求到 AI 大模型 API，隐藏真实密钥
- **AI 模型：** 支持切换多种国产大模型 API（通义千问、豆包、DeepSeek 等）

### 部署与工具

- **托管平台：** Netlify（自动部署、环境变量配置）
- **版本控制：** Git (GitHub)
- **本地开发：** VS Code

---

## 📁 项目结构

```
mood-calendar/
├── index.html           # 主页面
├── style.css           # 样式文件
├── script.js           # 核心逻辑（DOM操作、事件绑定、日历渲染）
├── netlify/
│   └── functions/      # Serverless 函数（AI 代理）
├── netlify.toml        # Netlify 配置文件
└── vercel.json        # Vercel 配置文件
```

---

## 🚀 快速部署

1. Fork 本仓库
2. 在 Netlify 或 Vercel 导入项目
3. 配置环境变量 `AI_API_KEY`
4. 自动部署完成

---

## 💡 使用说明

1. 打开应用，进入日历视图
2. 点击任意一天，记录当天心情
3. 输入一句话描述你的感受
4. AI 自动分析情绪并显示结果（😊 😐 😢）
5. 查看每月情绪统计图表，了解情绪趋势

---

## 🎯 适用场景

- 情绪管理与自我觉察
- 心理健康追踪
- 日常心情记录
- AI 大模型应用实践

---

## 📝 License

MIT License
```

去 GitHub 创建 `README.md` 吧。
