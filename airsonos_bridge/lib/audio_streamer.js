const EventEmitter = require('events');
const express = require('express');

class AudioStreamer extends EventEmitter {
  constructor(audioStream, options = {}) {
    super();
    
    this.audioStream = audioStream;
    this.options = {
      name: options.name || 'AirSonos Stream',
      port: 0, // Use 0 to get a random available port
      ...options
    };
    
    this.isRunning = false;
    this.httpServer = null;
    this.app = express();
    this.actualPort = null;
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    // Main audio stream endpoint
    this.app.get('/listen.m3u', (req, res) => {
      res.setHeader('Content-Type', 'audio/x-mpegurl');
      res.send(`#EXTM3U\n#EXTINF:-1,${this.options.name}\nhttp://${req.get('host')}/stream\n`);
    });
    
    // Direct audio stream endpoint  
    this.app.get('/stream', (req, res) => {
      console.log('Client connected to audio stream');
      
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
      // Handle client disconnect
      req.on('close', () => {
        console.log('Client disconnected from audio stream');
        this.emit('clientDisconnected');
      });
      
      req.on('error', (err) => {
        console.error('Stream request error:', err);
      });
      
      // Pipe audio stream to response
      if (this.audioStream && this.audioStream.readable) {
        this.audioStream.pipe(res, { end: false });
        
        // Handle audio stream errors
        this.audioStream.on('error', (err) => {
          console.error('Audio stream error:', err);
          res.end();
        });
        
        this.audioStream.on('end', () => {
          console.log('Audio stream ended');
          res.end();
        });
      } else {
        // Send silence if no audio stream available
        const silence = Buffer.alloc(1024, 0);
        const sendSilence = () => {
          if (!res.destroyed) {
            res.write(silence);
            setTimeout(sendSilence, 100);
          }
        };
        sendSilence();
      }
      
      this.emit('clientConnected', req);
    });
    
    // Stream info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        name: this.options.name,
        port: this.actualPort,
        status: this.isRunning ? 'running' : 'stopped'
      });
    });
  }
  
  start(port, callback) {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        if (callback) callback(this.actualPort);
        return resolve(this.actualPort);
      }
      
      const targetPort = port || this.options.port || 0;
      
      this.httpServer = this.app.listen(targetPort, '0.0.0.0', () => {
        this.actualPort = this.httpServer.address().port;
        this.isRunning = true;
        
        console.log(`Audio streamer listening on port ${this.actualPort}`);
        
        if (callback) callback(this.actualPort);
        resolve(this.actualPort);
      });
      
      this.httpServer.on('error', (err) => {
        console.error('Audio streamer error:', err);
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
      
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.isRunning = false;
          this.actualPort = null;
          console.log('Audio streamer stopped');
          resolve();
        });
      } else {
        this.isRunning = false;
        this.actualPort = null;
        resolve();
      }
    });
  }
  
  setMetadata(metadata) {
    // Handle metadata updates for the stream
    console.log('Stream metadata updated:', metadata);
    this.emit('metadataUpdate', metadata);
  }
  
  getStreamUrl(ip) {
    if (!this.isRunning || !this.actualPort) {
      return null;
    }
    return `http://${ip}:${this.actualPort}/listen.m3u`;
  }
}

module.exports = AudioStreamer;