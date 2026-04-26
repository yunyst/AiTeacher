# 🚀 快速开始指南

## 5 分钟运行项目

### 前置条件
- 已安装 Node.js (>= 18.0.0)

### 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 配置 API 密钥
echo "VITE_DEEPSEEK_API_KEY=your_api_key_here" > .env.local

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用！

## 📋 检查清单

在开始使用前，请确认以下配置：

- [ ] Node.js 版本 >= 18.0.0
- [ ] 已获取 DeepSeek API 密钥
- [ ] 已配置 `.env.local` 文件
- [ ] 端口 3000 未被占用
- [ ] 浏览器支持 WebGL

## 🔑 API 密钥获取

1. 访问 [DeepSeek Platform](https://platform.deepseek.com/)
2. 注册账号并登录
3. 前往 API Keys 页面创建新的 API 密钥
4. 在项目根目录创建 `.env.local` 文件：
   ```
   VITE_DEEPSEEK_API_KEY=你的密钥
   ```

## 🎯 首次使用

1. **选择课程**：从课程列表中选择一个数学课程
2. **开始学习**：AI 教师会自动开始讲解
3. **互动提问**：在聊天框中输入问题
4. **查看公式**：黑板会显示相关的数学公式

## ❓ 常见问题

**Q: 公式显示不正常？**
A: 确保 KaTeX 依赖已正确安装，刷新页面重试。

**Q: AI 无响应？**
A: 检查 API 密钥是否正确，查看浏览器控制台错误信息。

**Q: 3D 形象不显示？**
A: 检查浏览器是否支持 WebGL，更新显卡驱动。

需要详细帮助？查看 [完整安装文档](./INSTALLATION.md)。

## 💡 提示

项目现在使用 **DeepSeek AI** 作为核心 AI 引擎，提供强大的数学教学和对话功能！