let Promise = require('bluebird');
let events = require('events');
let AirPlayServer = require('./airplay_server');
let AudioStreamer = require('./audio_streamer');

// Helper to get local IP address
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// the SONOS library sometimes expects callbacks to function,
// even if we don't really care about the result
const EMPTY_CALLBACK = () => {};

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
    this.localIP = getLocalIP();

    this.bindAirplayServer();
  }

  bindAirplayServer() {
    // Create AirPlay server with ARM-compatible implementation
    this.airplayServer = new AirPlayServer(Object.assign({
      serverName: `${ this.deviceName } (AirSonos)`,
      port: 5000 + Math.floor(Math.random() * 1000) // Random port to avoid conflicts
    }, this.options));

    this.airplayServer.on('error', this.emit.bind(this, 'error'));

    let clientName = 'AirSonos';
    this.airplayServer.on('clientConnected', (clientInfo) => {
      clientName = `AirSonos @ ${ clientInfo.clientName || 'Unknown Device' }`;
      this.handleClientConnected(clientInfo);
    });

    this.airplayServer.on('volumeChange', (vol) => {
      // Convert AirPlay volume (-30 to 0) to Sonos volume (0 to 100)
      let targetVol = 100 - Math.floor(-1 * (Math.max(vol, -30) / 30) * 100);
      console.log(`Volume change: AirPlay ${vol} -> Sonos ${targetVol}`);
      this.device.setVolume(targetVol, EMPTY_CALLBACK);
    });

    this.airplayServer.on('metadataChange', (metadata) => {
      console.log('Metadata received:', metadata);
      if (this.audioStreamer) {
        this.audioStreamer.setMetadata(metadata);
      }
    });
  }

  handleClientConnected(clientInfo) {
    console.log(`AirPlay client connected: ${clientInfo.clientName || 'Unknown'}`);

    // Create a simple audio stream placeholder
    // In a real implementation, this would be the actual audio data from AirPlay
    const { Readable } = require('stream');
    const audioStream = new Readable({
      read() {
        // Generate silence for now - this would be replaced with actual audio data
        const silence = Buffer.alloc(1024, 0);
        this.push(silence);
        
        // Simulate real-time audio by adding a small delay
        setTimeout(() => {}, 23); // ~44.1kHz sample rate timing
      }
    });

    // Create audio streamer with ARM-compatible implementation
    this.audioStreamer = new AudioStreamer(audioStream, {
      name: `AirSonos @ ${ this.deviceName }`,
    });

    // Handle client disconnect
    this.airplayServer.on('clientDisconnected', () => {
      console.log('AirPlay client disconnected');
      this.device.stop(EMPTY_CALLBACK);
      if (this.audioStreamer) {
        this.audioStreamer.stop();
      }
    });

    // Start the audio stream server and connect Sonos to it
    this.audioStreamer.start(0, (port) => {
      const streamUrl = `x-rincon-mp3radio://${ this.localIP }:${ port }/listen.m3u`;
      
      console.log(`Starting audio stream on ${this.localIP}:${port}`);
      console.log(`Connecting Sonos device to: ${streamUrl}`);
      
      this.device.play({
        uri: streamUrl,
        metadata: this.generateSonosMetadata(this.deviceName),
      }, (err) => {
        if (err) {
          console.error('Failed to start Sonos playback:', err);
          this.emit('error', err);
        } else {
          console.log('Sonos device connected to audio stream');
        }
      });
    });
  }

  generateSonosMetadata(clientName) {
    return `<?xml version="1.0"?>
<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
<item id="R:0/0/49" parentID="R:0/0" restricted="true">
<dc:title>${ clientName }</dc:title>
<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON65031_</desc>
</item>
</DIDL-Lite>`;
  }

  start() {
    console.log(`Starting AirPlay server for ${this.deviceName}`);
    return this.airplayServer.start().then(() => {
      console.log(`AirPlay server successfully started for ${this.deviceName} on port ${this.airplayServer.options.port}`);
      console.log(`Device should be visible as "${this.deviceName} (AirSonos)" in AirPlay device list`);
    });
  }

  stop() {
    console.log(`Stopping tunnel for ${this.deviceName}`);
    
    const promises = [];
    
    if (this.airplayServer) {
      promises.push(this.airplayServer.stop());
    }
    
    if (this.audioStreamer) {
      promises.push(this.audioStreamer.stop());
    }
    
    return Promise.all(promises);
  }
}

module.exports = DeviceTunnel;