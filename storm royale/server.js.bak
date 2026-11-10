const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 4444;
const INDEX = path.join(__dirname, 'index (7).html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(INDEX, (err, data) => {
      if (err) { res.statusCode = 500; res.end('Error'); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(data);
    });
    return;
  }
  res.statusCode = 404;
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

const COLORS = [0xe63946,0x2a9d8f,0xf4a261,0x457b9d,0x9b5de5,0xffbe0b,0x06d6a0,0xef476f,0x3a86ff,0xff7b00,0x8ac926,0xff5d8f];

let seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
let t0 = Date.now();
let nextId = 1;
const clients = new Map(); // id -> {ws, name, color}

function broadcast(msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const [id, c] of clients) {
    if (id === exceptId) continue;
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(raw);
  }
}

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }

    if (m.t === 'join' && id === null) {
      id = 'p' + (nextId++);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const name = String(m.name || 'Jugador').slice(0, 16);
      clients.set(id, { ws, name, color });

      // Al nuevo jugador: estado inicial + lista de jugadores ya conectados
      ws.send(JSON.stringify({
        t: 'init',
        id, seed, t0, color,
        players: [...clients.entries()]
          .filter(([pid]) => pid !== id)
          .map(([pid, c]) => ({ id: pid, name: c.name, color: c.color }))
      }));

      // Al resto: aviso de que se ha unido
      broadcast({ t: 'join', id, name, color }, id);
      console.log(name, 'se ha unido como', id, '— jugadores conectados:', clients.size);
      return;
    }

    if (id === null) return; // debe unirse antes de enviar nada más

    // Todo mensaje del juego se reenvía tal cual al resto, añadiendo el id emisor
    switch (m.t) {
      case 'st':
      case 'shot':
      case 'hit':
      case 'build':
      case 'bhit':
      case 'prop':
      case 'drop':
      case 'pick':
      case 'chest':
      case 'die':
        broadcast(Object.assign({}, m, { id }), id);
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (id !== null) {
      const c = clients.get(id);
      clients.delete(id);
      broadcast({ t: 'leave', id });
      console.log((c ? c.name : id), 'se ha desconectado — jugadores conectados:', clients.size);
    }
  });
});

server.listen(PORT, () => {
  console.log('Storm Royale');
  console.log('Servidor de Storm Royale escuchando en http://localhost:' + PORT);
  console.log('WebSocket: ws://localhost:' + PORT);
});
