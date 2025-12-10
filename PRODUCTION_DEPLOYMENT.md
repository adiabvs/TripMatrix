# Production Deployment Guide

## Frontend Production Setup

### Environment Variables

For production deployment, you need to set the following environment variables:

#### Required:
- `NEXT_PUBLIC_API_URL` - Your production backend URL (e.g., `https://your-backend.railway.app`)

#### Firebase (same as development):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Build Commands

From the **root directory**:
```bash
# Build all packages first
pnpm build:packages

# Then build frontend
cd apps/frontend
pnpm build
```

Or from root:
```bash
pnpm build
```

### Start Commands

After building:
```bash
cd apps/frontend
pnpm start
```

The frontend will run on port 3000 by default, or use the `PORT` environment variable.

### Deployment Platforms

#### Railway
1. Create a new service for the frontend
2. Set root directory to `apps/frontend`
3. Set build command: `cd ../.. && pnpm build:packages && cd apps/frontend && pnpm build`
4. Set start command: `pnpm start`
5. Add environment variables (especially `NEXT_PUBLIC_API_URL`)

#### Vercel (Recommended for Next.js)
1. Connect your repository
2. Set root directory to `apps/frontend`
3. Vercel will auto-detect Next.js
4. Add environment variables in Vercel dashboard
5. Deploy!

#### Docker
```dockerfile
FROM node:18-alpine
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Important Notes

1. **API URL**: The frontend uses `NEXT_PUBLIC_API_URL` environment variable. If not set, it defaults to `http://localhost:3001` (development only).

2. **Port**: Next.js production server uses port 3000 by default. Set `PORT` environment variable to change it.

3. **Build Output**: The Next.js config is set to `standalone` mode for optimized production builds.

4. **Image Domains**: Supabase and Firebase storage domains are already configured in `next.config.js`.

### Testing Production Build Locally

```bash
# Build
cd apps/frontend
pnpm build

# Start production server
pnpm start

# Or with custom port
PORT=3000 pnpm start
```

Make sure to set `NEXT_PUBLIC_API_URL` to your backend URL before building!

