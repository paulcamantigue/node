'use strict';
const common = require('../common');
const assert = require('assert');

if (!common.hasCrypto) {
  common.skip('missing crypto');
  return;
}
const https = require('https');

const fs = require('fs');
const path = require('path');

const options = {
  key: fs.readFileSync(path.join(common.fixturesDir, 'test_key.pem')),
  cert: fs.readFileSync(path.join(common.fixturesDir, 'test_cert.pem'))
};

const bufSize = 1024 * 1024;
let sent = 0;
let received = 0;

const server = https.createServer(options, function(req, res) {
  res.writeHead(200);
  req.pipe(res);
});

server.listen(0, function() {
  let resumed = false;
  const req = https.request({
    method: 'POST',
    port: this.address().port,
    rejectUnauthorized: false
  }, function(res) {
    let timer;
    res.pause();
    console.error('paused');
    send();
    function send() {
      if (req.write(Buffer.allocUnsafe(bufSize))) {
        sent += bufSize;
        assert.ok(sent < 100 * 1024 * 1024); // max 100MB
        return process.nextTick(send);
      }
      sent += bufSize;
      console.error('sent: ' + sent);
      resumed = true;
      res.resume();
      console.error('resumed');
      timer = setTimeout(function() {
        process.exit(1);
      }, 1000);
    }

    res.on('data', function(data) {
      assert.ok(resumed);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      received += data.length;
      if (received >= sent) {
        console.error('received: ' + received);
        req.end();
        server.close();
      }
    });
  });
  req.write('a');
  ++sent;
});

process.on('exit', function() {
  assert.strictEqual(sent, received);
});
