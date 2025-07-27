#!/usr/bin/with-contenv bashio

bashio::log.info "Starting AirSonos Bridge..."

# Use default values since we removed config options
VERBOSE="false"
TIMEOUT="5"
PORT="5000"
MANUAL_DEVICES="[]"

bashio::log.info "Configuration: verbose=${VERBOSE}, timeout=${TIMEOUT}, port=${PORT}"
bashio::log.info "Manual devices: ${MANUAL_DEVICES}"

# Set environment variables
export VERBOSE="${VERBOSE}"
export TIMEOUT="${TIMEOUT}"
export PORT="${PORT}"
export MANUAL_DEVICES="${MANUAL_DEVICES}"

# Change to app directory
cd /app

# Start the main application
bashio::log.info "Starting AirSonos service..."
npm start