# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# Install with devDependencies for the build
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# App sources
COPY . .

# Build static site to /app/dist
RUN npm run build

# Runtime: Nginx serves the built files and proxies /api -> backend
FROM nginx:stable-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
