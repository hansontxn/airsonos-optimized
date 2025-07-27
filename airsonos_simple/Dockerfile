ARG BUILD_FROM=ghcr.io/home-assistant/base:latest
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set work directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Run
CMD ["node", "index.js"]