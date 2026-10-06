FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
EXPOSE 3001
CMD ["npm", "start"]
