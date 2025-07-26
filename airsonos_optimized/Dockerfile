ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:15.0.7
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js and dependencies
RUN \
    apk add --no-cache \
        nodejs=~20 \
        npm=~10 \
        avahi \
        avahi-tools \
        dbus

# Set work directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production \
    && npm cache clean --force

# Copy application files
COPY . .

# Set proper permissions
RUN chmod +x run.sh

# Expose port
EXPOSE 5000

# Labels
LABEL \
    io.hass.name="AirSonos Optimized" \
    io.hass.description="AirTunes to Sonos devices bridge with Home Assistant integration" \
    io.hass.arch="armhf|aarch64|amd64|armv7|i386" \
    io.hass.type="addon" \
    io.hass.version="0.3.0"

# Run
CMD [ "./run.sh" ]