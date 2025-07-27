#!/bin/bash

# Standalone Docker container for AirSonos
# Run this instead of the Home Assistant add-on

docker run -d \
  --name airsonos-standalone \
  --network host \
  --restart unless-stopped \
  node:18-alpine sh -c "
    apk add --no-cache git
    cd /tmp
    git clone https://github.com/hansontxn/airsonos-optimized.git
    cd airsonos-optimized/airsonos_bridge
    npm install
    echo 'Starting AirSonos...'
    node lib/index.js
  "

echo "AirSonos started as standalone Docker container"
echo "Check logs with: docker logs -f airsonos-standalone"
echo "Stop with: docker stop airsonos-standalone"