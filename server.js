const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const BotManager = require('./bot');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data.json');
let manager = new BotManager(io);

function saveState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(manager.getState(), null, 2));
}

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    manager.loadState(data);
  }
}

app.get('/', (req, res) => {
  res.render('index');
});

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('start', ({ startBal, leverage }) => {
    manager = new BotManager(io, startBal, leverage);
    manager.startAll();
    saveState();
  });

  socket.on('resume', () => {
    loadState();
    manager.resume();
  });

  socket.on('applySettings', ({ startBal, leverage }) => {
    manager.updateSettings(startBal, leverage);
    saveState();
  });

  socket.on('disconnect', () => {
    saveState();
    console.log('Client disconnected');
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
