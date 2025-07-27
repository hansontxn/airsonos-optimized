console.log('Starting AirSonos Simple...');

const sonos = require('sonos');
const bonjour = require('bonjour')();
const express = require('express');

// Simple AirPlay server
function createAirPlayServer(deviceName, port) {
  const app = express();
  
  app.get('/info', (req, res) => {
    res.json({
      name: deviceName,
      deviceid: '58:55:CA:06:12:34',
      features: '0x77',
      model: 'AirSonos,1'
    });
  });
  
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`AirPlay server for ${deviceName} listening on port ${port}`);
    
    // Advertise via Bonjour
    bonjour.publish({
      name: `${deviceName} (AirSonos)`,
      type: 'raop',
      protocol: 'tcp',
      port: port,
      txt: {
        txtvers: '1',
        ch: '2',
        cn: '0,1',
        sr: '44100'
      }
    });
    
    console.log(`Published AirPlay service: ${deviceName} (AirSonos)`);
  });
  
  return server;
}

// Discover Sonos devices
console.log('Discovering Sonos devices...');
const search = sonos.DeviceDiscovery();
const devices = [];

search.on('DeviceAvailable', (device) => {
  console.log(`Found Sonos device: ${device.host}:${device.port}`);
  devices.push(device);
});

setTimeout(() => {
  search.destroy();
  console.log(`Found ${devices.length} Sonos device(s)`);
  
  // Create AirPlay servers
  devices.forEach((device, index) => {
    const port = 5000 + index;
    const deviceName = `Sonos ${device.host}`;
    createAirPlayServer(deviceName, port);
  });
  
  if (devices.length === 0) {
    console.log('No Sonos devices found. Creating test AirPlay server...');
    createAirPlayServer('Test AirSonos', 5000);
  }
  
  // Keep alive
  setInterval(() => {
    console.log(`AirPlay servers running for ${devices.length} device(s)...`);
  }, 60000);
  
}, 5000);