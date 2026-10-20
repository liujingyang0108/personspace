# PersonSpace 开发接手文档

这份文档给下一位开发者或 Agent 使用。它记录的是当前代码状态、运行方式、数据流和已知风险。开始改代码前先读完“优先处理的问题”，其中几项会造成数据覆盖或隐私状态不一致。

## 1. 当前状态

项目是一个个人生活与成长空间，包含公开主页和登录后的私人工作台。代码已经推送到 `main` 分支，加入本文档前的基线提交为 `1dcc96b`。

| 项目 | 当前值 |
| --- | --- |
| GitHub | `https://github.com/liujingyang0108/personspace.git` |
| 本地目录 | `/Users/liujingyang/Documents/个人` |
| 前端 | React 19、TypeScript 6、Vite 8 |
| 云服务 | 腾讯云 CloudBase |
| CloudBase 环境 | `personspace-d7glmpjdpd81220f3` |
| 地域 | `ap-shanghai` |
| 数据库 | CloudBase PostgreSQL |
| 线上地址 | `https://personspace-d7glmpjdpd81220f3-1311920098.tcloudbaseapp.com` |
| CloudBase CLI | 3.8.7 |

2026-10-19 检查时，CloudBase 环境状态为 `Normal`。静态托管中既有应用文件，也有平台生成的 `__auth/*` 和 `cloud-admin/index.html`。部署脚本不能把这些文件当成旧资源清掉。

当前检查结果：

- `npm run test` 通过，7 个测试文件，共 20 个测试。
- `npm run lint` 通过。
- `npm run build` 通过。
- `npm audit --omit=dev --audit-level=high` 未发现已知漏洞。
- 生产 JavaScript 文件约 1.13 MB，Vite 会提示单包超过 500 kB。

## 2. 本地启动

```bash
cd /Users/liujingyang/Documents/个人
npm ci
cp .env.example .env
# 在 .env 中填写 CloudBase 的前端 Publishable Key
npm run dev
```

本地地址通常是 `http://127.0.0.1:5173`。这是开发服务器，不是线上域名。

`.env` 只在本机保存，已经被 `.gitignore` 排除。前端只应使用 CloudBase Publishable Key，不要把服务端密钥放进以 `VITE_` 开头的变量，因为 Vite 会把这些值写入浏览器代码。

提交代码前运行：

```bash
npm run test
npm run lint
npm run build
```

## 3. 页面和已有功能

应用使用 Hash 路由，没有引入路由库。

| 地址 | 页面 |
| --- | --- |
| `/#/` | 公开主页，读取已公开的站长资料和文章 |
| `/#/u/:slug` | 指定 slug 的公开主页 |
| `/#/login` | 注册、邮箱验证码和密码登录 |
| `/#/app` | 私人工作台 |

工作台内部页面由 `Workspace` 的 `page` 状态切换：

- 今日：任务、长期计划当天目标和快捷入口。
- 记录：按自定义分类管理内容，可设为私密或公开。
- 记录详情：从记录列表或今日页打开全文，可编辑、删除或调整公开状态。
- 计划：按日期、执行星期和分配方式生成每日目标。现有方式为平均、前松后紧、前紧后松。
- 复盘：按当天任务、长期计划和新增记录自动整理事实草稿，也可手动补充做得好的事情、调整项和下一步。
- 公开主页：预览公开记录。
- 设置：修改公开资料、主题、浏览器通知和示例数据。

浏览器提醒每 30 秒检查一次。只有页面处于运行状态且用户允许 Notification 权限时，提醒才会出现。关闭浏览器后的推送还没有实现。

## 4. 代码位置

```text
src/App.tsx                    页面、认证入口、同步逻辑、弹窗和主要交互
src/App.css                    组件与响应式样式
src/index.css                  全局变量、主题和基础样式
src/types.ts                   业务数据类型
src/data/seed.ts               首次打开时的示例数据
src/data/normalize.ts          旧数据与默认字段合并
src/lib/date.ts                本地日期转换
src/lib/entries.ts             记录替换、删除和公开状态切换
src/lib/plan.ts                长期计划拆分与进度计算
src/lib/review.ts              每日任务、计划和记录的复盘汇总与草稿生成
src/services/cloudbase.ts      CloudBase 认证、RDB 请求和公开数据同步
src/services/localStore.ts     浏览器离线副本
src/services/reminders.ts      页面存活期间的提醒检查
cloudbase/migrations/*.sql     PostgreSQL 表、触发器、授权和 RLS
cloudbaserc.json               CloudBase 环境与静态托管配置
public/sw.js                   生产环境 Service Worker
```

`src/App.tsx` 目前约 950 行。修复同步问题时，建议先用测试固定行为，再拆出 `useAuthSession`、`useAppDataSync` 和页面组件。不要先做纯粹的文件拆分，否则很难判断同步行为是否被改坏。

## 5. 数据模型

`AppData` 是私人工作台的完整快照：

```text
AppData
├── profile       公开主页资料与开关
├── categories    自定义记录分类和模板
├── entries       记录正文、标签和可见范围
├── tasks         日期、时间、完成状态和颜色
├── plans         总量、日期、执行星期、分配方式和每日进度
└── reflections   每日复盘
```

数据库有三张表：

| 表 | 用途 | 可见范围 |
| --- | --- | --- |
| `personspace_profiles` | 主页资料、slug、站长标记和公开开关 | 已公开的站长资料允许匿名读取；本人可读写自己的行 |
| `personspace_states` | `AppData` 的 JSONB 完整快照 | 仅当前认证用户 |
| `personspace_public_entries` | 公开文章的查询副本 | 站长主页公开时允许匿名读取 |

`personspace_states.version` 已建字段，但保存时一直写入 `1`，还没有承担冲突检测作用。

## 6. 当前数据流

登录进入工作台后，`Workspace` 先从固定的 localStorage 键 `life-os:data:v1` 读取数据，再请求 `personspace_states`。

```text
浏览器本地副本
      ↓ 先显示
Workspace 状态 ← 云端完整快照
      ↓ 数据变化后延迟 700 ms
personspace_states + personspace_profiles + personspace_public_entries
```

所有界面修改都会先写 localStorage。`cloudReady` 为真时，代码再调用 `saveCloudData()`：先覆盖私人快照，再保存资料，最后删除并重建公开文章列表。这里没有事务，也没有请求队列。

开发环境通过 Vite 代理访问 CloudBase：

- `/cloudbase-auth` 转发认证请求。
- `/cloudbase-rdb` 转发 PostgreSQL REST 请求。

生产环境直接访问 `https://personspace-d7glmpjdpd81220f3.api.tcloudbasegateway.com`。

## 7. 优先处理的问题

### P0：避免旧本地数据覆盖云端

`src/App.tsx` 在云端读取失败后仍把 `cloudReady` 设为 `true`。网络恢复后，本地旧快照可能覆盖云端较新的数据。

建议把同步改成明确状态机，例如 `hydrating`、`clean`、`dirty`、`syncing`、`offline` 和 `conflicted`。首次读取失败时可以让用户离线查看，但禁止自动上传。恢复连接后先重新读取并比较版本。

验收条件：

- 模拟 `loadCloudData()` 失败后，不能出现任何云端写请求。
- 两个客户端基于同一版本编辑时，后提交者收到冲突结果，不能静默覆盖。
- `version` 由数据库递增，更新时校验客户端读到的版本。

### P0：把站长初始化移到可信边界

当前浏览器先调用 `ownerExists()`，再决定是否把登录用户写成 `is_owner=true`。RLS 只检查 `auth.uid() = user_id`，没有禁止普通客户端设置站长字段。新环境中，最先完成注册的人可能认领站点。

另外，`ownerExists()` 依赖匿名可见的公开资料。站长关闭公开主页后，登录页会误判为尚未初始化并重新显示注册流程。

需要一个服务端初始化流程，可以用一次性初始化令牌、控制台预设用户或受保护的数据库函数。普通客户端不能写 `is_owner`。登录入口也不能依赖主页是否公开。

验收条件：

- 匿名查询只能获得不含个人信息的 `site_initialized` 结果。
- 关闭公开主页后，已有站长仍能看到正常登录表单。
- 第二个认证用户无法插入或更新 `is_owner=true`。
- 站长初始化与唯一性检查在同一事务中完成。

### P0：保证公开转私密真正生效

`syncPublicEntries()` 先删除全部公开文章，再批量插入当前公开集合。删除失败时，已改成私密的旧文章可能继续公开；删除成功但插入失败时，公开主页会被清空。私人快照和公开副本之间也没有事务。

把这段操作移入 PostgreSQL 函数或受保护的服务端接口。按文章 ID 和修订号更新公开状态，隐私收紧操作需要持久化重试，并以服务端确认作为“已同步”的依据。

### P1：收紧本地缓存和 Service Worker

`localStore.ts` 对所有账号使用同一个键。共享浏览器换账号后，新用户可能先看到上一个账号的数据，甚至把它上传到自己的空间。存储键应包含用户 ID，退出和切换账号时应清除内存中的旧数据。

`public/sw.js` 现在缓存所有 GET 响应，其中可能包含认证和数据库响应。它还会在任意请求失败时回退到首页。改为只缓存同源静态文件和页面导航，排除带 `Authorization` 的请求、CloudBase 域名、认证路径和 RDB 路径。

### P1：修正危险操作和统计范围

- “恢复示例数据”没有确认步骤，而且重置结果会继续同步到云端。增加明确警告、二次确认和备份策略。
- 今日焦点与复盘统计使用了全部任务，没有按 `dueDate` 过滤。应分别计算今日、逾期和未来任务。
- `currentUser()` 与公开主页加载会把请求错误吞成“未登录”或“没有内容”。界面要区分无数据、未授权和网络故障。

## 8. 测试缺口

已有测试只覆盖计划计算、本地存储和提醒。下一轮至少补这些用例：

1. 云端读取失败后不上传本地快照。
2. 延迟请求乱序完成时，旧保存不能覆盖新保存。
3. 版本冲突进入冲突状态。
4. 隐藏公开主页后仍显示登录入口。
5. 非站长用户不能认领 `is_owner`。
6. 公开转私密失败时有重试记录，界面不能提前显示“已同步”。
7. Service Worker 不缓存认证、RDB 和带授权头的请求。
8. localStorage 按用户隔离。
9. 今日任务和复盘统计只使用正确日期范围。

涉及 RLS 的测试应在测试 CloudBase 环境或本地 PostgreSQL 中执行，不要用生产数据跑破坏性场景。

## 9. 数据库变更

数据库迁移放在 `cloudbase/migrations/`，新变更应新增迁移文件，不要重写已经部署的迁移。文件名继续使用时间戳前缀。

执行前先看计划：

```bash
tcb deploy --dry-run
```

涉及 RLS、站长初始化或公开文章事务时，先在非生产环境验证以下角色：

- 匿名用户只能读取已公开主页和文章。
- 已认证用户只能读写自己的私人状态。
- 普通用户不能设置站长标记。
- 主页隐藏后，匿名访问不到资料和文章，但站长仍可登录。

## 10. 发布流程

当前静态托管根目录同时包含 CloudBase 管理的认证文件。`cloudbaserc.json` 中的 `prune: true` 有误删 `__auth/*` 的风险，修正部署配置前不要执行带清理的发布。

安全的静态文件发布步骤：

```bash
npm ci
npm run test
npm run lint
npm run build
tcb hosting deploy ./dist -e personspace-d7glmpjdpd81220f3 --safe --verify
tcb hosting list -e personspace-d7glmpjdpd81220f3 --json
```

不要给上面的命令增加 `--prune`。发布后确认 `index.html`、当前哈希命名的 JS/CSS、`manifest.webmanifest`、`sw.js` 和 `__auth/*` 同时存在，再访问线上地址检查：

- 首页能打开。
- 登录和退出正常。
- 私人工作台能读取云端数据。
- 新增私密记录后，公开主页不可见。
- 新增公开记录后，公开主页可见。
- 刷新页面后路由和登录状态不丢失。

## 11. 开发约束

- 不提交 `.env`、访问令牌、服务端密钥或用户数据。
- 不直接修改生产数据库中的真实内容来验证功能。
- 不用强制推送覆盖 `main` 历史。
- 修改同步、认证、RLS 或公开状态时，必须同时增加相应测试。
- 保留现有中文界面和浅色、深色主题，移动端宽度也要检查。
- 未完成 P0 问题前，不把 localStorage 当成可靠备份，也不要向用户承诺多设备无冲突同步。

## 12. 建议的接手顺序

从站长授权和同步安全开始。第一批改动应覆盖数据库迁移、`cloudbase.ts` 和对应测试；第二批处理公开文章事务；第三批再调整 localStorage、Service Worker 和 UI 错误状态。

每批都保持可独立回滚。完成一批后运行全部检查，确认线上部署方案不会删除 CloudBase 管理文件，再进入下一批。
