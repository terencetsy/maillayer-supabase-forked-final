FROM node:20-alpine

WORKDIR /app

# Install PM2
RUN npm install -g pm2

# Copy the application
COPY . .

# Install dependencies
RUN npm install

# Try to build with error logging
RUN npm run build || (echo "BUILD ERROR DETAILS:" && cat /root/.npm/_logs/*-debug-0.log && false)

# Make worker scripts executable
RUN chmod +x workers/*.js

# Expose the port Next.js runs on
EXPOSE 3000

# Start the application using PM2
CMD ["npm", "run", "pm2:start"]