# Use a lightweight Node.js base image
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV PORT=5001
EXPOSE 5001

CMD ["node", "app.js"]
