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
          try {
            search.destroy();
          } catch (err) {
            console.log('Discovery cleanup completed');
          }
          resolve(foundDevices);
        }, 2000);
      });
      
      search.on('timeout', () => {
        try {
          search.destroy();
        } catch (err) {
          console.log('Discovery cleanup completed');
        }
        console.log(`Discovery timeout - found ${foundDevices.length} device(s)`);
        resolve(foundDevices);
      });
    });
  }

  getManualDevices() {
    try {
      const manualDevicesEnv = process.env.MANUAL_DEVICES || '[]';
      console.log('Raw manual devices string:', manualDevicesEnv);
      
      // Handle Home Assistant's multi-line JSON format
      let cleanedJson = manualDevicesEnv.replace(/\n/g, '').trim();
      if (!cleanedJson.startsWith('[')) {
        cleanedJson = '[' + cleanedJson + ']';
      }
      
      const manualDevicesConfig = JSON.parse(cleanedJson);
      
      return manualDevicesConfig.map(device => {
        console.log(`Creating manual device: ${device.name} at ${device.ip}:${device.port || 1400}`);
        return new sonos.Sonos(device.ip, device.port || 1400);
      });
    } catch (error) {
      console.error('Error parsing manual devices configuration:', error);
      console.error('Raw manual devices value:', process.env.MANUAL_DEVICES);
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
