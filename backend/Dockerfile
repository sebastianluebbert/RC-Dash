FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

# Install git for version management
RUN apk add --no-cache git

WORKDIR /app

# Build argument for git repository URL
ARG GIT_REPO_URL=https://github.com/sebastianluebbert/RC-Dash.git

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/schema.sql ./dist/database/

# Clone repository for version info (shallow clone)
RUN git clone --depth 1 --branch main ${GIT_REPO_URL} /tmp/repo && \
    cp -r /tmp/repo/.git ./.git && \
    rm -rf /tmp/repo

# Copy package.json for version info
COPY package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
