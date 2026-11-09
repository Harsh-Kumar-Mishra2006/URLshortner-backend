# ---------- Stage 1: Install deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first → better layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

# Set NODE_ENV
ENV NODE_ENV=production

# Copy installed deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY . .

# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Document the port (change to match your app)
EXPOSE 5000

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start the app
CMD ["node", "src/index.js"]