ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:15.0.7
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install system dependencies
RUN apk add --no-cache \
    nodejs=~20 \
    npm=~10 \
    alsa-utils \
    avahi-dev \
    avahi-tools \
    dbus \
    ffmpeg \
    git \
    python3 \
    make \
    g++ \
    linux-headers

# Set working directory
WORKDIR /opt/airsonos

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY src/ ./src/
COPY lib/ ./lib/
COPY config/ ./config/
COPY translations/ ./translations/
COPY scripts/ ./scripts/
COPY run.sh ./
COPY apparmor.txt ./

# Make run script executable
RUN chmod +x run.sh

# Set up logging
RUN mkdir -p /var/log/airsonos

# Expose ports
EXPOSE 5000 8099

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8099/health || exit 1

# Labels
LABEL \
    io.hass.name="AirSonos Optimized" \
    io.hass.description="High-performance AirPlay to Sonos bridge" \
    io.hass.arch="armhf|aarch64|i386|amd64" \
    io.hass.type="addon" \
    io.hass.version="0.3.0"

# Run
CMD ["./run.sh"]