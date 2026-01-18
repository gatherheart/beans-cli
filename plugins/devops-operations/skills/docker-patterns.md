---
name: docker-patterns
triggers:
  - dockerfile
  - docker build
  - container
  - multi-stage build
  - docker compose
---

# Docker Patterns

## Use When

User requests help with:
- Writing Dockerfiles
- Optimizing container builds
- Docker Compose configuration
- Container security
- Multi-stage builds

## Instructions

### Multi-Stage Build Pattern

Reduces final image size by separating build and runtime:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

### Security Best Practices

1. **Non-root user**: Always run as non-root
2. **Minimal base image**: Use alpine or distroless
3. **No secrets in layers**: Use build secrets or runtime injection
4. **Scan images**: Use Trivy or Snyk
5. **Pin versions**: Avoid `latest` tags

### Layer Optimization

Order instructions from least to most frequently changed:

```dockerfile
# Rarely changes
FROM node:20-alpine

# Changes with dependencies
COPY package*.json ./
RUN npm ci

# Changes with code
COPY . .
RUN npm run build
```

## Resources

### Docker Compose Example

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      target: runtime
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### .dockerignore

```
node_modules
.git
.env*
*.md
tests
coverage
```
