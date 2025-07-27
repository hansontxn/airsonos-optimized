#!/usr/bin/env node

require("core-js/stable");

let flags = require('flags');
let AirSonos = require('./airsonos');

flags.defineBoolean('diagnostics', false, 'run diagnostics utility');
flags.defineBoolean('version', false, 'return version number');
flags.defineInteger('timeout', 5, 'disconnect timeout (in seconds)');
flags.defineBoolean('verbose', false, 'show verbose output');
flags.parse();

if (flags.get('version')) {

  let pjson = require('../package.json');
  console.log(pjson.version);

} else if (flags.get('diagnostics')) {

  let diag = require('../lib/diagnostics');
  diag();

} else {

  console.log('Searching for Sonos devices on network...\n');

  let instance = new AirSonos({
    verbose: flags.get('verbose'),
    timeout: flags.get('timeout'),
  });

  instance.start().timeout(30000).then((tunnels) => {

    tunnels.forEach((tunnel) => {
      console.log(`${ tunnel.deviceName } (@ ${ tunnel.device.host }:${ tunnel.device.port }, ${ tunnel.device.groupId || 'unknown' })`);
    });

    console.log(`\nSearch complete. Set up ${ tunnels.length } device tunnel${ tunnels.length === 1 ? '' : 's' }.`);
    console.log('AirPlay servers are running. Check your AirPlay device list!');
    
    // Keep the process running
    setInterval(() => {
      console.log('AirPlay servers still running...');
    }, 60000);
  }).catch((err) => {
    console.error('Failed to start AirPlay servers:', err);
    process.exit(1);
  }).done();

}
