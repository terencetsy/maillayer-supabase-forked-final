FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start Next.js directly without building in container
# (assumes you've built the app locally before deploying)
CMD ["npm", "start"]