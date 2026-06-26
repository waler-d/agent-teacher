# 一键配置指南（Agent Teacher）

> 生产地址：**https://agent-teacher-xi.vercel.app**  
> Webhook：**https://agent-teacher-xi.vercel.app/api/feishu/webhook**

---

## 已完成（无需你再做）

- [x] 代码已 push 到 GitHub
- [x] Vercel 项目已创建并部署到生产环境
- [x] 生产域名：`https://agent-teacher-xi.vercel.app`

---

## 你需要配合的 3 件事

### A. Cursor API Key（约 1 分钟）

1. 打开 [Cursor Integrations](https://cursor.com/dashboard/integrations)
2. 创建 API Key，复制 `cursor_...` 开头的密钥
3. 把密钥发给 Agent，或自己运行：

```powershell
cd C:\Users\waler\agent-teacher
.\scripts\setup-vercel-env.ps1 -CursorApiKey "cursor_你的密钥"
```

### B. Upstash Redis（约 2 分钟）

1. 打开 [Vercel → agent-teacher → Storage](https://vercel.com/walers-projects-486fb7df/agent-teacher/stores)
2. 点击 **Create Database** → 选 **Upstash Redis** → 区域选离中国近的（如 `ap-southeast-1`）
3. 创建后点 **Connect to Project**，勾选 Production
4. 环境变量 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 会自动写入

### C. 飞书自建应用（约 10 分钟）

按下面「飞书逐步操作」完成，把 **App ID、App Secret、Verification Token** 发给 Agent 或运行脚本。

---

## 飞书逐步操作

### 1. 创建应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app) → **创建企业自建应用**
2. 名称建议：**记忆策略导师**

### 2. 凭证

**凭证与基础信息** 页复制：

- App ID → `FEISHU_APP_ID`
- App Secret → `FEISHU_APP_SECRET`

### 3. 机器人

**添加应用能力** → 添加 **机器人**

### 4. 权限（全部开通后发布版本）

| 权限 |
|------|
| im:message |
| im:message:send_as_bot |
| im:message.group_at_msg:readonly |
| im:message.p2p_msg:readonly |
| im:resource |

### 5. 事件订阅

**事件与回调** → 请求地址填：

```
https://agent-teacher-xi.vercel.app/api/feishu/webhook
```

- 复制 **Verification Token** → `FEISHU_VERIFICATION_TOKEN`
- **不要开启 Encrypt Key**（除非后续单独配置解密）
- 订阅事件：**im.message.receive_v1**
- 保存（应显示验证通过）
- **发布版本**

### 6. 安装到企业

**版本管理与发布** → 发布 → **安装应用**到企业

### 7. 在飞书里使用

- **私聊**：搜索「记忆策略导师」
- **群聊**：群设置 → 群机器人 → 添加 → @机器人 发消息

---

## 写入环境变量（Agent 或你本地执行）

```powershell
cd C:\Users\waler\agent-teacher
.\scripts\setup-vercel-env.ps1 `
  -CursorApiKey "cursor_xxx" `
  -FeishuAppId "cli_xxx" `
  -FeishuAppSecret "xxx" `
  -FeishuVerificationToken "xxx"
```

执行后自动 redeploy。

---

## 验证

1. 浏览器打开：https://agent-teacher-xi.vercel.app/api/feishu/webhook  
   应看到 `{"service":"agent-teacher","platform":"feishu","status":"ready"}`
2. 飞书私聊机器人发：`你好`
3. 约 1～2 分钟内应收到回复

---

## Cursor Cloud Agent 连接 GitHub

打开 [Cloud Agents Dashboard](https://cursor.com/dashboard?tab=cloud-agents)，授权 GitHub 仓库 **waler-d/agent-teacher**。
