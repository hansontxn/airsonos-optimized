let Promise = require('bluebird');
let events = require('events');

// Stub version for testing without native dependencies
class DeviceTunnel extends events.EventEmitter {

  static createFor(device, options={}) {
    const getZoneAttrs = Promise.promisify(device.getZoneAttrs.bind(device));

    return getZoneAttrs().then((zoneAttrs) => {
      return new DeviceTunnel(device, zoneAttrs.CurrentZoneName, options);
    });
  }

  constructor(device, deviceName, options) {
    super();

    this.device = device;
    this.deviceName = deviceName;
    this.options = options;

    console.log(`DeviceTunnel created for ${deviceName} (stub mode - no AirPlay functionality)`);
  }

  start() {
    console.log(`Starting tunnel for ${this.deviceName} (stub mode)`);
  }

  stop() {
    console.log(`Stopping tunnel for ${this.deviceName} (stub mode)`);
  }
}

module.exports = DeviceTunnel;