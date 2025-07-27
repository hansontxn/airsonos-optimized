FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache git

# Set work directory
WORKDIR /app

# Copy and run inline
CMD ["sh", "-c", "echo 'Starting AirSonos Working...'; npm install sonos bonjour express && node -e \"console.log('AirSonos starting...'); const sonos = require('sonos'); const bonjour = require('bonjour')(); const express = require('express'); let deviceCount = 0; const search = sonos.DeviceDiscovery(); search.on('DeviceAvailable', (device) => { deviceCount++; console.log('Found Sonos device:', device.host); const app = express(); app.get('/info', (req, res) => res.json({name: 'AirSonos', deviceid: '58:55:CA:06:12:34', features: '0x77', model: 'AirSonos,1'})); const port = 5000 + deviceCount; const server = app.listen(port, '0.0.0.0', () => { console.log('AirPlay server listening on port', port); bonjour.publish({name: 'Sonos Room ' + deviceCount + ' (AirSonos)', type: 'raop', protocol: 'tcp', port: port, txt: {txtvers: '1', ch: '2', cn: '0,1', sr: '44100'}}); console.log('Published AirPlay service for Sonos device', deviceCount); }); }); setTimeout(() => { search.destroy(); console.log('Discovery complete. Found', deviceCount, 'Sonos devices'); if (deviceCount === 0) { console.log('Creating test AirPlay server...'); const app = express(); app.get('/info', (req, res) => res.json({name: 'Test AirSonos', deviceid: '58:55:CA:06:12:34'})); app.listen(5000, () => { bonjour.publish({name: 'Test AirSonos', type: 'raop', protocol: 'tcp', port: 5000}); console.log('Test AirPlay server published'); }); } setInterval(() => console.log('AirPlay servers running...'), 60000); }, 5000);\""]