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

const COLORS = [0x4cc94c,0x2a9d8f,0xf4a261,0x457b9d,0x9b5de5,0xffbe0b,0x06d6a0,0xef476f,0x3a86ff,0xff7b00,0x8ac926,0xff5d8f];

let nextId = 1;
const clients = new Map(); // id -> {ws, name, color, inMatch}
let lobby = null; // {seed, t0, endsAt, timer, started, players:Set}

function broadcast(msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const [id, c] of clients) {
    if (id === exceptId) continue;
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(raw);
  }
}
function broadcastLobby(msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const [id, c] of clients) {
    if (id === exceptId) continue;
    if (lobby && lobby.players.has(id) && c.ws.readyState === c.ws.OPEN) c.ws.send(raw);
  }
}
function ensureLobby() {
  if (lobby && !lobby.started) return lobby;
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  lobby = { seed, t0: null, endsAt: Date.now() + 10000, timer: null, started: false, players: new Set() };
  lobby.timer = setTimeout(startLobby, 10000);
  return lobby;
}
function startLobby() {
  if (!lobby || lobby.started) return;
  lobby.started = true;
  lobby.t0 = Date.now();
  const humans = [...lobby.players].map(id => {
    const c = clients.get(id); return c ? { id, name: c.name, color: c.color, bot: false } : null;
  }).filter(Boolean);
  const need = 24;
  const bots = [];
  for (let i = 0; i < need; i++) bots.push({ id: 'bot' + (i + 1), name: 'Bot' + (i + 1), color: 0xff5c5c, bot: true });
  const players = humans.concat(bots);
  const raw = JSON.stringify({ t: 'start', seed: lobby.seed, t0: lobby.t0, players });
  for (const id of lobby.players) {
    const c = clients.get(id);
    if (c && c.ws.readyState === c.ws.OPEN) { c.inMatch = true; c.ws.send(raw); }
  }
  console.log('Partida iniciada con', humans.length, 'humanos y', need, 'bots');
}

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }

    if (m.t === 'join' && id === null) {
      id = 'p' + (nextId++);
      const color = 0x4cc94c; // verde
      const name = String(m.name || 'Jugador').slice(0, 100);
      clients.set(id, { ws, name, color, inMatch: false });

      const lb = ensureLobby();
      lb.players.add(id);
      const players = [...lb.players].filter(pid => pid !== id).map(pid => {
        const c = clients.get(pid); return c ? { id: pid, name: c.name, color: c.color } : null;
      }).filter(Boolean);
      ws.send(JSON.stringify({ t: 'lobby', id, color, seed: lb.seed, endsAt: lb.endsAt, players }));
      broadcastLobby({ t: 'join', id, name, color }, id);
      console.log(name, 'se unió al lobby como', id, '— en lobby:', lb.players.size);
      return;
    }

    if (id === null) return;

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
      case 'die': {
        const from = m.bid || id;
        broadcast(Object.assign({}, m, { id: from }), id);
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (id !== null) {
      const c = clients.get(id);
      if (lobby) lobby.players.delete(id);
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
