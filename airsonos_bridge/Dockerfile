ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:15.0.7
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set work directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files  
COPY . .

# Set permissions
RUN chmod +x run_simple.sh

# Run
CMD [ "./run_simple.sh" ]