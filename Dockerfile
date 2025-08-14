# Dockerfile for Cloud Run deployment

FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package files 並安裝依賴
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 複製所有應用程式檔案
COPY . .

# 建立非 root 用戶
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Cloud Run 會自動設定 PORT 環境變數
EXPOSE 8080

# 啟動應用程式
CMD ["npm", "start"]