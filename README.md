# 留白 · 个人生活与成长空间

这是“公开主页 + 私人工作台”的第一阶段交互原型，当前重点验证记录分类、长期计划分配、今日工作台和视觉方向。

## 当前已经实现

- 今日任务与计划进度
- 自定义记录分类
- 分类模板与记录创建
- 私密/公开记录区分
- 长期计划平均、前松后紧、前紧后松分配
- 自定义执行日和每日提醒时间
- 计划分配预览与总量校验
- 公开主页预览
- 浅色/深色模式
- 手机与桌面响应式布局
- 浏览器本地持久化

## 本地运行

```bash
npm install
npm run dev
```

## 检查

```bash
npm run test
npm run build
```

## 腾讯云环境

- CloudBase 环境：`personspace-d7glmpjdpd81220f3`
- 地域：上海（`ap-shanghai`）
- 静态托管域名：<https://personspace-d7glmpjdpd81220f3-1311920098.tcloudbaseapp.com>
- 部署配置：`cloudbaserc.json`

预览部署计划：

```bash
tcb deploy --dry-run
```

正式发布前需要先完成用户登录和私人数据访问控制，再运行 `tcb deploy`。

## 当前边界

项目已经绑定腾讯云 CloudBase 环境，但业务数据暂时仍保存在当前浏览器的 `localStorage` 中，仅用于原型验证。下一阶段将把 `src/services/localStore.ts` 替换为云端数据服务，并增加登录、跨设备同步、服务端提醒和数据备份。为了避免私人工作台在没有权限保护时公开，当前尚未执行正式部署。
