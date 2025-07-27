ARG BUILD_FROM=ghcr.io/home-assistant/base:latest
FROM $BUILD_FROM

# Install Node.js and build dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    linux-headers

# Set work directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with build tools
RUN npm install --production

# Copy application files  
COPY . .

# Set permissions
RUN chmod +x run_simple.sh

# Clean up build dependencies to save space
RUN apk del make g++ linux-headers

# Run
CMD [ "./run_simple.sh" ]