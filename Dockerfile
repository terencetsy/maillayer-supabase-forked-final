FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Make worker scripts executable 
RUN chmod +x workers/*.js || true

# Try to build with debugging information
RUN npm run build || (echo "Build failed with error code $?" && exit 1)

# Production image
FROM node:20-alpine

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/logs ./logs

# Expose port
EXPOSE 3000

# Start PM2 using the ecosystem file in production mode
CMD ["pm2-runtime", "ecosystem.config.js"]