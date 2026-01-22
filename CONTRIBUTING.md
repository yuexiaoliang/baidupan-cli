# 贡献指南

感谢您有兴趣为百度网盘管理器 (baiduwangpan-manager) 做出贡献！

## 开发设置

1. Fork 此仓库
2. 克隆您的 fork: `git clone https://github.com/<your-username>/baiduwangpan-manager.git`
3. 进入项目目录: `cd baiduwangpan-manager`
4. 安装依赖: `pnpm install`
5. 启动开发模式: `pnpm dev`

## 开发工作流

- 在 `src/` 目录下编写代码
- 在 `test/` 目录下编写测试
- 运行 `pnpm test` 执行测试
- 运行 `pnpm lint` 检查代码风格
- 运行 `pnpm build` 构建项目

## 提交更改

1. 创建一个新分支: `git checkout -b feature/your-feature-name`
2. 提交更改: `git add . && git commit -m 'feat: 添加新功能'`
3. 推送到分支: `git push origin feature/your-feature-name`
4. 创建 Pull Request

## 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 保持代码简洁易懂
- 添加适当的类型注解
- 为新功能编写单元测试

## 问题报告

当提交问题时，请包含:
- 详细的错误描述
- 重现步骤
- 您的环境信息 (操作系统、Node.js 版本等)
- 可能的话，提供错误截图或日志

## 功能建议

欢迎提出功能建议！请在 Issue 中详细描述:
- 您希望实现的功能
- 为什么需要这个功能
- 使用场景
