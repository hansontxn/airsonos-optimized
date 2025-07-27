ARG BUILD_FROM=ghcr.io/home-assistant/base:latest
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set work directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application files  
COPY . .

# Set permissions
RUN chmod +x run_simple.sh

# Run
CMD [ "./run_simple.sh" ]