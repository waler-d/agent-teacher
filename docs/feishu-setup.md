# 飞书开放平台配置指南

本文说明如何将 **Agent Teacher**（记忆策略学习导师）接入飞书，并与 Vercel 上的 Webhook 对接。

---

## 前置条件

- 已完成 Vercel 部署，Webhook 地址形如：  
  `https://<你的项目>.vercel.app/api/feishu/webhook`
- 已在 Vercel 配置环境变量（见项目根目录 `.env.example`）
- 你拥有飞书企业管理员权限，或能创建/发布企业自建应用

---

## 第一步：创建企业自建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)
2. 点击 **创建企业自建应用**
3. 填写应用名称（如「记忆策略导师」）和描述
4. 创建完成后，进入应用详情页

---

## 第二步：获取凭证

在 **凭证与基础信息** 页面记录：

| 字段 | 对应环境变量 |
|------|-------------|
| App ID | `FEISHU_APP_ID` |
| App Secret | `FEISHU_APP_SECRET` |

将这两项填入 Vercel 项目 **Settings → Environment Variables**。

---

## 第三步：开启机器人能力

1. 左侧菜单 → **添加应用能力**
2. 添加 **机器人**
3. 在机器人设置中填写机器人名称（用户 @ 时看到的名字）

---

## 第四步：配置 API 权限

进入 **权限管理** → **开通权限**，搜索并开通以下权限：

| 权限 | 用途 |
|------|------|
| `im:message` | 读取用户发给机器人的消息 |
| `im:message:send_as_bot` | 以机器人身份回复消息 |
| `im:message.group_at_msg:readonly` | 群聊 @ 机器人时接收消息（群聊场景） |
| `im:message.p2p_msg:readonly` | 接收私聊消息（可选，私聊场景） |
| `im:resource` | 下载用户上传的 PPT 文件（**上传 PPT 入库必需**） |

详见 [PPT 上传指南](./ppt-upload.md)。

开通后点击 **发布版本**，让权限生效。

---

## 第五步：配置事件订阅

1. 左侧菜单 → **事件与回调** → **事件配置**
2. **请求地址** 填写：

   ```
   https://<你的-vercel-域名>/api/feishu/webhook
   ```

3. **Verification Token**：平台会生成一串 Token，复制到 Vercel 环境变量 `FEISHU_VERIFICATION_TOKEN`

4. **Encrypt Key**（可选）：
   - 若开启「加密」，复制 Encrypt Key 到 `FEISHU_ENCRYPT_KEY`
   - 当前项目默认支持明文 + Token 校验；若你开启了加密，需告知以便补充解密逻辑

5. 点击 **保存** 后，飞书会向你的 Webhook 发送 `url_verification` 挑战；部署正常时会自动返回 `challenge`

6. 在 **订阅事件** 中添加：

   | 事件 | 说明 |
   |------|------|
   | `im.message.receive_v1` | 接收消息（必加） |

7. 再次 **发布版本**

---

## 第六步：验证 Webhook 可用

在浏览器访问：

```
https://<你的-vercel-域名>/api/feishu/webhook
```

应返回 JSON：

```json
{ "service": "agent-teacher", "platform": "feishu", "status": "ready" }
```

若飞书事件配置页显示「验证通过」，说明 URL 与 Token 配置正确。

---

## 第七步：安装应用到企业

1. **版本管理与发布** → 创建版本 → 提交审核/发布（企业自建应用通常可直接发布）
2. **应用发布** → 将应用安装到你的企业/workspace
3. 在飞书 **群聊** 中：
   - 群设置 → 群机器人 → 添加机器人 → 选择你的应用
4. 或在飞书中 **搜索机器人名称** 发起私聊

---

## 第八步：测试对话

在群聊中 @机器人 或私聊发送：

```
我想背 30 个英语单词，怎么安排复习？
```

或发送 **PPT 文件**（.ppt / .pptx），机器人会引导你提炼章节并入库。

复习相关指令：

```
复习
考我
不会
```

- **复习 / 考我**：到期知识点 ≥ 3 个时，会出提取式题目（一次一题）
- **不会**：该知识点加强复习，1～2 天内再考

预期行为：

1. 飞书立即收到 HTTP 200（后台异步处理）
2. 约 30 秒～2 分钟后，机器人回复基于 **memory-strategy** 的记忆计划

若长时间无回复，按下方排查。

---

## 常见问题排查

### 1. 事件配置验证失败

- 确认 Vercel 已部署最新代码
- 确认 `FEISHU_VERIFICATION_TOKEN` 与飞书控制台完全一致
- 查看 Vercel **Functions → Logs** 是否有 403 / 500

### 2. 能收到消息但无回复

- 检查 `CURSOR_API_KEY` 是否有效
- 检查 `CURSOR_AGENT_REPO_URL` 是否指向已连接 Cursor 的 GitHub 仓库
- 检查 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 是否已配置
- 查看 Vercel 函数日志中的 Cursor Agent 报错

### 3. 群聊 @ 无反应

- 确认已开通 `im:message.group_at_msg:readonly`
- 确认机器人已添加到该群
- 确认订阅了 `im.message.receive_v1`

### 4. Cloud Agent 找不到 skill

- 确认 `.cursor/skills/memory-strategy/` 已 push 到 GitHub
- 在 Cursor Dashboard 确认 Cloud Agent 已授权该仓库
- 本地更新 skill 后运行 `npm run sync:skill` 并 push

---

## 环境变量速查

```env
# Cursor
CURSOR_API_KEY=
CURSOR_AGENT_REPO_URL=https://github.com/waler-d/agent-teacher
CURSOR_AGENT_REPO_REF=main

# 飞书
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=

# 会话（Upstash Redis）
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 相关链接

- [飞书开放平台文档 — 接收消息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive)
- [Cursor Cloud Agents Dashboard](https://cursor.com/dashboard?tab=cloud-agents)
- [Cursor API Keys](https://cursor.com/dashboard/integrations)
- [Vercel 环境变量](https://vercel.com/docs/projects/environment-variables)
