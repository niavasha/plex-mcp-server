FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build artifacts
COPY tsconfig.json ./
COPY src/ ./src/
COPY build/ ./build/

# Build (in case there are any TS changes)
RUN npm run build 2>/dev/null || true

EXPOSE 3100

ENTRYPOINT ["node", "build/plex-mcp-server.js"]
CMD ["--transport", "http", "--port", "3100"]