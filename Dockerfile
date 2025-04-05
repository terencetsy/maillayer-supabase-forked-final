FROM node:20-alpine

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Make worker scripts executable
RUN chmod +x workers/*.js || true

# Expose port
EXPOSE 3000

# Start PM2 using the ecosystem file from the project root
CMD ["pm2-runtime", "ecosystem.config.js"]