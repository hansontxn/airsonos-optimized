ARG BUILD_FROM=homeassistant/amd64-base:latest
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js and dependencies
RUN \
    apk add --no-cache \
        nodejs=18.18.2-r0 \
        npm=9.8.1-r0 \
        git \
        python3 \
        make \
        g++ \
        avahi-dev \
        avahi-compat-libdns_sd \
        dbus \
    && apk add --no-cache --virtual .build-dependencies \
        build-base \
        linux-headers

# Set work directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production \
    && npm cache clean --force

# Copy application files
COPY . .

# Build the application
RUN npm run prepublish

# Set proper permissions
RUN chmod +x run.sh

# Remove build dependencies
RUN apk del .build-dependencies

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node /app/lib/health-check.js || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Labels
LABEL \
    io.hass.name="AirSonos Optimized" \
    io.hass.description="AirTunes to Sonos devices bridge with HACS optimization" \
    io.hass.arch="armhf|aarch64|amd64|armv7|i386" \
    io.hass.type="addon" \
    io.hass.version="0.3.0"

# Run
CMD [ "./run.sh" ]