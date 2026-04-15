# Stage 1: Install production dependencies
# Build tools are needed to compile sharp (native module)
FROM node:18-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
# color@5 is ESM-only; pin to v4 which supports CommonJS require()
RUN npm ci --only=production && npm install color@4.2.3

# Stage 2: Production image (no build tools, minimal footprint)
FROM node:18-alpine

WORKDIR /app

# dumb-init: proper PID 1 / signal handling for Node.js in Docker
RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodeapp \
    && chown -R nodeapp:nodejs /app

USER nodeapp

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
