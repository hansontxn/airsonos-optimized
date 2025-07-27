#!/usr/bin/with-contenv bashio

bashio::log.info "Starting AirSonos Bridge..."

# Get configuration from Home Assistant
VERBOSE=$(bashio::config 'verbose' 'false')
TIMEOUT=$(bashio::config 'timeout' '5')
PORT=$(bashio::config 'port' '5000')

bashio::log.info "Configuration: verbose=${VERBOSE}, timeout=${TIMEOUT}, port=${PORT}"

# Set environment variables
export VERBOSE="${VERBOSE}"
export TIMEOUT="${TIMEOUT}"
export PORT="${PORT}"
export MANUAL_DEVICES="[]"

# Change to app directory
cd /app

# Start the main application
bashio::log.info "Starting AirSonos service..."
npm start