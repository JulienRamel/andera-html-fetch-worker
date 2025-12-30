FROM mcr.microsoft.com/playwright:v1.52.0-jammy AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "dist/app.js"]

