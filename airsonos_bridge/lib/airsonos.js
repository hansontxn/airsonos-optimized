let Promise = require('bluebird');
let sonos = require('sonos');
let DeviceTunnel = require('./tunnel_full');

class AirSonos {

  constructor(options) {
    this.tunnels = {};
    this.options = options || {};
  }

  searchForDevices() {
    return new Promise((resolve, reject) => {
      // Check for manual devices first
      const manualDevices = this.getManualDevices();
      if (manualDevices.length > 0) {
        console.log(`Using ${manualDevices.length} manually configured device(s)`);
        resolve(manualDevices);
        return;
      }

      // Fall back to automatic discovery
      console.log('No manual devices configured, attempting automatic discovery...');
      const search = sonos.DeviceDiscovery();
      const foundDevices = [];
      
      search.on('DeviceAvailable', (device) => {
        console.log(`Found Sonos device: ${device.host}:${device.port}`);
        foundDevices.push(device);
        
        // Continue searching for more devices for a short time
        setTimeout(() => {
          search.destroy();
          resolve(foundDevices);
        }, 2000);
      });
      
      search.on('timeout', () => {
        search.destroy();
        console.log(`Discovery timeout - found ${foundDevices.length} device(s)`);
        resolve(foundDevices);
      });
    });
  }

  getManualDevices() {
    try {
      const manualDevicesEnv = process.env.MANUAL_DEVICES || '[]';
      const manualDevicesConfig = JSON.parse(manualDevicesEnv);
      
      return manualDevicesConfig.map(device => {
        console.log(`Creating manual device: ${device.name} at ${device.ip}:${device.port || 1400}`);
        return new sonos.Sonos(device.ip, device.port || 1400);
      });
    } catch (error) {
      console.error('Error parsing manual devices configuration:', error);
      return [];
    }
  }

  start() {
    return this.searchForDevices().then((devices) => {

      let promises = devices.map((device) => {
        return DeviceTunnel.createFor(device, this.options).then((tunnel) => {

          tunnel.on('error', function(err) {
            if (err.code === 415) {
              console.error('Warning!', err.message);
              console.error('AirSonos currently does not support codecs used by applications such as iTunes or AirFoil.');
              console.error('Progress on this issue: https://github.com/stephen/nodetunes/issues/1');
            } else {
              console.error('Unknown error:');
              console.error(err);
            }
          });

          tunnel.start();
          this.tunnels[tunnel.device.groupId] = tunnel;

          return tunnel;
        });
      });

      return Promise.all(promises);
    });
  }

  refresh() {
    return this.searchForDevices().then((devices) => {
      // remove old groups
      // add new groups
      // update existing groups with new configurations
    });
  }

  stop() {
    return Promise.all(this.tunnels.map(tunnel.stop));
  }
}

module.exports = AirSonos;
