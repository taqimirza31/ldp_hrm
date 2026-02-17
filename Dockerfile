# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (include devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

# Runtime user
RUN addgroup -g 1001 -S appuser && adduser -u 1001 -S appuser -G appuser

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Own app files
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
