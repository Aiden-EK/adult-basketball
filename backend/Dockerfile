FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js db.js ./
COPY routes ./routes
COPY services ./services
COPY middleware ./middleware
COPY scripts ./scripts

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
