const EventEmitter = require('events');
const bonjour = require('bonjour')();
const express = require('express');

class AirPlayServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      serverName: options.serverName || 'AirSonos',
      port: options.port || 5000,
      ...options
    };
    
    this.isRunning = false;
    this.httpServer = null;
    this.bonjourAd = null;
    this.app = express();
    this.currentClient = null;
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    // AirPlay device info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        name: this.options.serverName,
        deviceid: '58:55:CA:06:12:34', // Fake MAC address
        features: '0x77',
        model: 'AirSonos,1',
        srcvers: '130.14',
        statusflags: '0x4',
        vv: '2'
      });
    });
    
    // AirPlay reverse HTTP endpoint for client connections
    this.app.post('/reverse', (req, res) => {
      console.log('AirPlay client connected');
      this.currentClient = req.connection.remoteAddress;
      this.emit('clientConnected', {
        clientName: req.headers['x-apple-device-name'] || 'Unknown Device',
        address: this.currentClient
      });
      res.status(101).end();
    });
    
    // Volume control endpoint
    this.app.put('/volume', express.raw(), (req, res) => {
      const volume = parseFloat(req.body.toString());
      console.log(`Volume change: ${volume}`);
      this.emit('volumeChange', volume);
      res.status(200).end();
    });
    
    // Audio stream endpoint (placeholder for now)
    this.app.post('/stream', express.raw(), (req, res) => {
      console.log('Audio stream started');
      this.emit('audioStream', req);
      res.status(200).end();
    });
    
    // Metadata endpoint
    this.app.post('/setMetadata', express.json(), (req, res) => {
      console.log('Metadata:', req.body);
      this.emit('metadataChange', req.body);
      res.status(200).end();
    });
  }
  
  start() {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        return resolve();
      }
      
      // Start HTTP server
      this.httpServer = this.app.listen(this.options.port, '0.0.0.0', () => {
        const actualPort = this.httpServer.address().port;
        this.options.port = actualPort;
        console.log(`AirPlay HTTP server listening on port ${actualPort}`);
        
        // Advertise AirPlay service via Bonjour
        console.log(`Publishing AirPlay service: ${this.options.serverName}`);
        this.bonjourAd = bonjour.publish({
          name: this.options.serverName,
          type: 'raop',
          protocol: 'tcp',
          port: actualPort,
          txt: {
            txtvers: '1',
            ch: '2',              // stereo
            cn: '0,1',            // codec (PCM)
            et: '0,1',            // encryption types
            sv: 'false',          // require password
            tp: 'UDP',            // transport protocol
            sm: 'false',          // supports metadata
            ss: '16',             // sample size
            sr: '44100',          // sample rate
            pw: 'false',          // password required
            vn: '3',              // version
            md: '0,1,2',          // metadata
            vs: '130.14',         // server version
            da: 'true',           // device available
            am: 'AirSonos,1'      // model
          }
        });
        
        console.log(`✅ AirPlay service published: ${this.options.serverName} on port ${actualPort}`);
        console.log(`   Service type: _raop._tcp`);
        console.log(`   Device should appear in AirPlay device lists`);
        
        this.isRunning = true;
        resolve();
      });
      
      this.httpServer.on('error', (err) => {
        console.error('AirPlay server error:', err);
        this.emit('error', err);
        reject(err);
      });
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        return resolve();
      }
      
      // Unpublish Bonjour service
      if (this.bonjourAd) {
        this.bonjourAd.stop();
        this.bonjourAd = null;
      }
      
      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.isRunning = false;
          console.log('AirPlay server stopped');
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }
  
  setMetadata(metadata) {
    // Handle metadata updates
    this.emit('metadataChange', metadata);
  }
}

module.exports = AirPlayServer;