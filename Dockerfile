FROM mcr.microsoft.com/playwright:v1.64.1-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE ${PORT}
USER pwuser

CMD ["node", "dist/app.js"]
