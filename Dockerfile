FROM node:20-alpine

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build for production
RUN npm run build

# Make worker scripts executable
RUN chmod +x workers/*.js || true

# Expose port
EXPOSE 3000

# Start with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
