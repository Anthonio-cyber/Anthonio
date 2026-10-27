# ==========================================================
# Grade 8 Hub - production container
#
# Runs the hub as a normal long-lived Node server, which is what
# the live messaging needs. Works on Render, Railway, Fly.io,
# Koyeb, a school server, or any machine with Docker.
# ==========================================================
FROM node:22-slim

ENV NODE_ENV=production

# The database and uploaded pictures live here. Mount a persistent
# disk at /data or everything is lost when the server restarts.
ENV DATABASE_FILE=/data/grade8hub.db
ENV UPLOAD_DIR=/data/uploads
ENV PORT=3000

WORKDIR /app

# Install dependencies first so rebuilds stay fast.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p /data/uploads \
 && chown -R node:node /app /data

# Never run the server as root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
