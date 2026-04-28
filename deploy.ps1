# =============================================================
# iPAS AI 應用規劃師 模擬考工具 — 一鍵部署到 GitHub Pages
# 用法：在 PowerShell 執行 .\deploy.ps1
# =============================================================

$ErrorActionPreference = "Stop"

# 強制 console 用 UTF-8 顯示中文，避免亂碼
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  iPAS 模擬考工具 - GitHub Pages 一鍵部署" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 確認 git 已安裝
try {
    $gitVer = git --version
    Write-Host "[OK] Git 已安裝：$gitVer" -ForegroundColor Green
} catch {
    Write-Host "[X] 找不到 git，請先安裝 Git for Windows：https://git-scm.com/download/win" -ForegroundColor Red
    Read-Host "按 Enter 離開"
    exit 1
}

# 2. 切換到腳本所在目錄
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "[OK] 工作目錄：$scriptDir" -ForegroundColor Green
Write-Host ""

# 3. 詢問 GitHub 帳號與 repo 名稱
$ghUser = Read-Host "請輸入你的 GitHub 帳號"
if ([string]::IsNullOrWhiteSpace($ghUser)) {
    Write-Host "[X] 帳號不可為空" -ForegroundColor Red
    Read-Host "按 Enter 離開"
    exit 1
}

$repoName = Read-Host "請輸入 repo 名稱 (直接 Enter = ipas-ai-exam-simulator)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "ipas-ai-exam-simulator"
}

$remoteUrl = "https://github.com/$ghUser/$repoName.git"
Write-Host ""
Write-Host "Remote URL：$remoteUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "請先確認你已經在 GitHub 上建立了這個 repo (空的就好，不要加 README)：" -ForegroundColor Yellow
Write-Host "  https://github.com/new" -ForegroundColor Cyan
Write-Host ""
$confirm = Read-Host "已建立好按 Y 繼續，其他鍵離開"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "已取消" -ForegroundColor Yellow
    Read-Host "按 Enter 離開"
    exit 0
}

# 4. git init / add / commit / push
Write-Host ""
Write-Host "-> 初始化 git repo..." -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    git init | Out-Null
    Write-Host "   [OK] git init 完成" -ForegroundColor Green
} else {
    Write-Host "   [-] 已是 git repo，略過 init" -ForegroundColor Gray
}

# 設定預設分支為 main
git branch -M main 2>$null

Write-Host "-> 加入檔案..." -ForegroundColor Cyan
git add .

# 確認有東西要 commit
$staged = git status --porcelain
if ([string]::IsNullOrWhiteSpace($staged)) {
    Write-Host "   [-] 沒有變更需要 commit" -ForegroundColor Gray
} else {
    Write-Host "-> 建立 commit..." -ForegroundColor Cyan
    git commit -m "feat: initial iPAS AI exam simulator" | Out-Null
    Write-Host "   [OK] commit 完成" -ForegroundColor Green
}

# 設定 / 更新 remote
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "-> 更新 remote origin -> $remoteUrl" -ForegroundColor Cyan
    git remote set-url origin $remoteUrl
} else {
    Write-Host "-> 加入 remote origin -> $remoteUrl" -ForegroundColor Cyan
    git remote add origin $remoteUrl
}

# Push
Write-Host ""
Write-Host "-> 推送到 GitHub... (第一次會跳出登入視窗，用瀏覽器授權即可)" -ForegroundColor Cyan
Write-Host ""
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[X] Push 失敗。常見原因：" -ForegroundColor Red
    Write-Host "  1. repo 名稱在 GitHub 上不存在 -> 到 https://github.com/new 建立" -ForegroundColor Yellow
    Write-Host "  2. GitHub 登入失敗 -> 確認 Git Credential Manager 有正確認證" -ForegroundColor Yellow
    Write-Host "  3. repo 已有內容 -> 在 GitHub 砍掉重建，或先 git pull origin main --rebase" -ForegroundColor Yellow
    Read-Host "按 Enter 離開"
    exit 1
}

# 5. 成功訊息
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "             *** 推送成功 ***" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：開啟 GitHub Pages" -ForegroundColor Cyan
Write-Host "  1. 前往 https://github.com/$ghUser/$repoName/settings/pages" -ForegroundColor White
Write-Host "  2. Source 選 [GitHub Actions]" -ForegroundColor White
Write-Host "  3. 等 1-2 分鐘 Actions 跑完" -ForegroundColor White
Write-Host ""
Write-Host "完成後你的網址會是：" -ForegroundColor Cyan
Write-Host "  https://$ghUser.github.io/$repoName/" -ForegroundColor Yellow
Write-Host ""

# 自動開啟 Settings 頁面
$openSettings = Read-Host "現在自動幫你開啟 Settings/Pages 頁面? (Y/N)"
if ($openSettings -eq "Y" -or $openSettings -eq "y") {
    Start-Process "https://github.com/$ghUser/$repoName/settings/pages"
}

Read-Host "按 Enter 離開"
