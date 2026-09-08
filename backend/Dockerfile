FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js db.js ./
COPY routes ./routes
COPY services ./services
COPY middleware ./middleware

EXPOSE 3000

CMD ["npm", "start"]
