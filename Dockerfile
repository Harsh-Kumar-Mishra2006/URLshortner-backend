# Use official Node.js LTS (alpine = lightweight ~50MB)
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy rest of the source code
COPY . .

# Expose the port your app runs on (default 3000)
EXPOSE 3000

# Start the app
CMD ["node", "app.js"]