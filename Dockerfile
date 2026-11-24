# Use the lightweight Alpine version of Node.js 20
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy only the package files first to leverage Docker layer caching
COPY package*.json ./

# Install ALL dependencies (we need devDependencies here temporarily if we wanted to run tests, 
# but for a production image, we omit them to keep it small. See note below).
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Set the environment to production by default
ENV NODE_ENV=production

# Run the app as a non-root user for security
USER node

# Expose the port your app runs on (assuming 3000 based on your code)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
