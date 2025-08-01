# Dockerfile

# --- 第一階段：建置階段 (Build Stage) ---
# 使用一個包含完整建置工具的 Node.js 映像檔
FROM node:20-alpine AS build

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝生產環境所需的依賴套件
RUN npm ci --only=production

# --- 第二階段：生產階段 (Production Stage) ---
# 使用一個更輕量、更安全的 Node.js 映像檔
FROM node:20-alpine AS production

# 從建置階段複製 Node.js 執行環境所需的依賴項
COPY --from=build /usr/src/app/node_modules ./node_modules

# 複製你的應用程式原始碼
COPY . .

# 向外界宣告你的應用程式將在哪個 port 運行
# Cloud Run 會自動使用這個設定
EXPOSE 8080

# 啟動應用程式的指令
CMD [ "npm", "start" ]