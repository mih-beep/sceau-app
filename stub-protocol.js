const http = require('http');
const crypto = require('crypto');
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/seal') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ seal_id: crypto.randomUUID(), timestamp: new Date().toISOString(), anchor_tx: 'tx-' + crypto.randomBytes(4).toString('hex') }));
  } else { res.writeHead(404); res.end(); }
}).listen(8080, () => console.log('✅ Stub prêt sur 8080'));