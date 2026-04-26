# 长大互动教师 v1.2 - 安装与使用文档

<div align="center">
<h2>🎓 互动数学教学平台</h2>
<p>基于 React + Three.js + AI 的现代化教学工具</p>
</div>

## 📋 项目概述

长大互动教师是一个功能丰富的在线教学平台，集成了 3D 虚拟教师、AI 智能答疑、数学公式渲染、PDF 课件展示等功能。

### ✨ 主要功能

- 🤖 **AI 虚拟教师**：支持文本和语音交互的智能教师助手
- 📐 **数学公式渲染**：基于 KaTeX 的高质量数学公式显示
- 📄 **PDF 课件支持**：集成 PDF.js 实现课件展示和翻页
- 🎨 **3D 虚拟形象**：使用 Three.js 创建的 3D 教师形象
- 💬 **实时对话**：支持学生与教师的实时交流
- 🎯 **互动选择题**：支持互动教学题目
- ☁️ **云端同步**：基于 Supabase 的数据存储和同步

## 🛠️ 技术栈

### 前端核心
- **React 19.2.0** - 现代化 UI 框架
- **TypeScript 5.8.2** - 类型安全的 JavaScript
- **Vite 6.3.6** - 快速的构建工具

### 3D 与动画
- **Three.js 0.180.0** - 3D 图形库
- **@react-three/fiber 9.3.0** - React Three.js 渲染器
- **@react-three/drei 10.7.6** - Three.js 实用工具

### AI 与数据处理
- **DeepSeek API** - AI 对话和教学助手
- **@supabase/supabase-js 2.74.0** - 后端即服务

### 文档与公式
- **KaTeX 0.16.23** - 数学公式渲染引擎
- **PDF.js 4.5.136** - PDF 文档处理

### 状态管理
- **Zustand 5.0.8** - 轻量级状态管理

## 🔧 系统要求

### 必需软件
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 或 **yarn** >= 1.22.0

### 推荐配置
- 内存：至少 4GB RAM
- 存储：至少 2GB 可用空间
- 网络：稳定的互联网连接（用于 AI API 调用）

## 📦 安装步骤

### 1. 克隆项目

```bash
git clone [项目仓库地址]
cd Teacher1.2
```

### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 3. 环境配置

创建环境变量文件：

```bash
# 复制示例文件（如果存在）
cp .env.example .env.local

# 或直接创建
touch .env.local
```

在 `.env.local` 文件中配置以下变量：

```env
# DeepSeek API 密钥（必需）
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Supabase 配置（可选，用于云端同步）
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 获取 API 密钥

#### DeepSeek API（必需）
1. 访问 [DeepSeek Platform](https://platform.deepseek.com/)
2. 注册账号并登录
3. 前往 API Keys 页面创建新的 API 密钥
4. 将密钥添加到 `.env.local` 文件中的 `VITE_DEEPSEEK_API_KEY`

## 🚀 运行项目

### 开发模式

```bash
npm run dev
```

项目将在以下地址启动：
- 本地：http://localhost:3000
- 网络：http://[你的IP]:3000

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 📂 项目结构

```
Teacher1.2/
├── components/           # React 组件
│   ├── Avatar.tsx       # 3D 虚拟形象组件
│   ├── Blackboard.tsx   # 黑板/PDF 显示组件
│   ├── ChatWindow.tsx   # 聊天窗口组件
│   ├── VirtualTutor.tsx # 虚拟教师组件
│   └── ...
├── hooks/               # React 自定义钩子
│   ├── useLipSync.ts   # 唇形同步钩子
│   └── ...
├── services/            # API 服务层
│   ├── geminiService.ts # Gemini AI 服务
│   ├── ttsService.ts    # 文本转语音服务
│   └── ...
├── lessons/             # 课程内容
│   ├── sum-of-integers-cn.ts
│   ├── difference-of-squares-cn.ts
│   └── ...
├── lib/                 # 工具库
├── store/               # 状态管理
├── types.ts             # TypeScript 类型定义
├── constants.ts         # 常量定义
├── App.tsx              # 主应用组件
├── index.tsx            # 应用入口
├── index.html           # HTML 模板
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── package.json         # 项目配置
└── README.md           # 项目说明
```

## 🔧 配置说明

### Vite 配置 (vite.config.ts)

```typescript
export default defineConfig({
  server: {
    port: 3000,           // 开发服务器端口
    host: '0.0.0.0',      // 允许外部访问
  },
  plugins: [react()],     // React 插件
  define: {
    // 环境变量注入
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'), // 路径别名
    }
  }
});
```

### TypeScript 配置

- 目标：ES2022
- 模块：ESNext
- JSX：react-jsx
- 支持路径别名 `@/*`

## 🎯 功能使用指南

### 数学公式渲染

项目使用 KaTeX 进行数学公式渲染，支持 LaTeX 语法：

```latex
# 行内公式
$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

# 独立公式
$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$
```

### PDF 课件展示

1. 将 PDF 文件放置在可访问的位置
2. 在应用中选择 PDF 作为内容类型
3. 使用翻页控件浏览课件

### AI 对话功能

1. 在聊天框中输入问题
2. AI 教师会提供详细解答
3. 支持数学问题解答和概念解释

### 3D 虚拟教师

- 实时语音同步
- 表情和动作响应
- 自定义外观设置

## 🐛 故障排除

### 常见问题

#### 1. 依赖安装失败
```bash
# 清除缓存
npm cache clean --force
# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 2. API 密钥错误
- 确保 `.env.local` 文件中 `VITE_DEEPSEEK_API_KEY` 正确配置
- 检查 DeepSeek API 密钥是否有效
- 确认 API 密钥权限设置
- 确保账户有足够的 API 配额

#### 3. 端口占用
```bash
# 查找占用端口的进程
netstat -tulpn | grep :3000
# 或修改端口
npm run dev -- --port 3001
```

#### 4. 数学公式不显示
- 检查 KaTeX 依赖是否正确安装
- 确认 LaTeX 语法正确
- 查看浏览器控制台错误信息

#### 5. 3D 渲染问题
- 检查浏览器 WebGL 支持
- 更新显卡驱动
- 降低渲染质量设置

### 性能优化建议

1. **内存使用**：
   - 关闭不必要的浏览器标签页
   - 定期重启开发服务器

2. **网络优化**：
   - 使用稳定的网络连接
   - 考虑使用 API 调用缓存

3. **浏览器兼容性**：
   - 推荐使用最新版 Chrome/Firefox/Edge
   - 确保启用 WebGL 和 JavaScript

## 🤝 贡献指南

### 开发规范

1. **代码风格**：
   - 使用 TypeScript 进行类型检查
   - 遵循 React Hooks 规范
   - 组件使用函数式写法

2. **提交规范**：
   - feat: 新功能
   - fix: 修复问题
   - docs: 文档更新
   - style: 代码格式调整
   - refactor: 代码重构

### 开发流程

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'feat: add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 📞 支持与反馈

- 📧 邮箱支持：[项目维护者邮箱]
- 🐛 问题反馈：[GitHub Issues 链接]
- 💬 讨论交流：[GitHub Discussions 链接]

## 🔄 更新日志

### v1.2.0 (最新版本)
- ✨ 迁移 KaTeX 到本地依赖
- 🐛 修复数学公式渲染问题
- 🚀 优化加载性能
- 🔧 改进开发环境配置

### v1.1.0
- ✨ 添加 PDF 课件支持
- 🤖 集成 Gemini AI
- 🎨 3D 虚拟教师功能
- 💬 实时对话系统

---

<div align="center">
<p>🎓 让教育更加智能和互动</p>
<p>Made with ❤️ by [你的团队名称]</p>
</div>