#!/usr/bin/with-contenv bashio

bashio::log.info "Starting AirSonos Bridge..."

# Test mode - just run a simple echo and keep running
echo "AirSonos Bridge test mode started successfully"
echo "Add-on is running and ready"

# Keep the container running
while true; do
    sleep 60
    echo "AirSonos Bridge is still running..."
done