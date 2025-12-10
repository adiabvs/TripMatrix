# Use Node.js 18 with pnpm support
FROM node:18-alpine

# Enable corepack for pnpm (comes with Node.js 18+)
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy root package files first (for better Docker layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace packages
COPY packages ./packages

# Copy all apps
COPY apps ./apps

# Install dependencies using pnpm (not npm!)
RUN pnpm install --frozen-lockfile

# Build all packages and apps
RUN pnpm build

# Set working directory to backend
WORKDIR /app/apps/backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the backend server
CMD ["pnpm", "start"]

