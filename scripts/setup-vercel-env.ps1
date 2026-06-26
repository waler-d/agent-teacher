param(
  [Parameter(Mandatory = $true)]
  [string]$CursorApiKey,
  [string]$FeishuAppId = "",
  [string]$FeishuAppSecret = "",
  [string]$FeishuVerificationToken = "",
  [string]$FeishuEncryptKey = "",
  [switch]$SkipRedeploy
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Add-VercelEnv {
  param([string]$Name, [string]$Value, [string]$Env = "production")
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  Write-Host "设置 $Name ..."
  $Value | npx vercel env add $Name $Env --force 2>&1 | Out-Null
  $Value | npx vercel env add $Name preview --force 2>&1 | Out-Null
  $Value | npx vercel env add $Name development --force 2>&1 | Out-Null
}

Write-Host "=== Agent Teacher 环境变量配置 ===" -ForegroundColor Cyan

Add-VercelEnv "CURSOR_API_KEY" $CursorApiKey
Add-VercelEnv "CURSOR_AGENT_REPO_URL" "https://github.com/waler-d/agent-teacher"
Add-VercelEnv "CURSOR_AGENT_REPO_REF" "main"
Add-VercelEnv "CURSOR_AGENT_MODEL" "composer-2.5"

Add-VercelEnv "FEISHU_APP_ID" $FeishuAppId
Add-VercelEnv "FEISHU_APP_SECRET" $FeishuAppSecret
Add-VercelEnv "FEISHU_VERIFICATION_TOKEN" $FeishuVerificationToken
Add-VercelEnv "FEISHU_ENCRYPT_KEY" $FeishuEncryptKey

Write-Host ""
Write-Host "Webhook 地址（飞书事件订阅用）：" -ForegroundColor Yellow
Write-Host "https://agent-teacher-xi.vercel.app/api/feishu/webhook"
Write-Host ""

if (-not $SkipRedeploy) {
  Write-Host "正在 redeploy 生产环境 ..." -ForegroundColor Cyan
  npx vercel deploy --prod --yes
}

Write-Host "完成。请确认 Upstash Redis 已在 Vercel Storage 中连接。" -ForegroundColor Green
