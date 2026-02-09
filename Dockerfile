FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace config first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy package.json files for each workspace package
COPY packages/engine/package.json packages/engine/
COPY packages/network/package.json packages/network/
COPY packages/mcp/package.json packages/mcp/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/engine/ packages/engine/
COPY packages/network/ packages/network/
COPY packages/mcp/ packages/mcp/

# Build all packages
RUN pnpm -r build

# Default environment variables
ENV NODECOIN_PLAYER_NAME=Node1
ENV NODECOIN_DATA_DIR=/data

# Expose default P2P and MCP ports
EXPOSE 9000

# Create data directory
RUN mkdir -p /data

CMD ["node", "packages/mcp/dist/index.js"]
