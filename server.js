const express = require('express');
const ccxt = require('ccxt');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

let running = false;
let VIRTUAL_BALANCES = { USD: 10000, BTC: 0 };
let TRADE_LOG = [];
let latestData = [];
let lastSignal = 'NONE';
let tradeSizePercent = 100;

// EMA and RSI calculation
function EMA(values, period) {
    let k = 2 / (period + 1);
    let emaArray = [];
    values.forEach((v, i) => {
        if (i === 0) emaArray.push(v);
        else emaArray.push(v * k + emaArray[i - 1] * (1 - k));
    });
    return emaArray;
}

function RSI(values, period = 14) {
    let gains = [], losses = [];
    for (let i = 1; i < values.length; i++) {
        let diff = values[i] - values[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let rsArray = [avgGain / avgLoss];
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsArray.push(avgGain / avgLoss);
    }
    return rsArray.map(r => 100 - 100 / (1 + r));
}

// Fetch Kraken BTC/USD
async function fetchData() {
    const kraken = new ccxt.kraken();
    let ohlcv = await kraken.fetchOHLCV('BTC/USD', '1h', undefined, 100);
    return ohlcv.map(o => o[4]); // close prices
}

// Trading logic
function checkSignal(closes) {
    let ema9 = EMA(closes, 9);
    let ema21 = EMA(closes, 21);
    let rsi = RSI(closes, 14);
    let lastIndex = closes.length - 1;
    if (ema9[lastIndex] > ema21[lastIndex] && rsi[rsi.length - 1] < 70) return 'BUY';
    if (ema9[lastIndex] < ema21[lastIndex] && rsi[rsi.length - 1] > 30) return 'SELL';
    return null;
}

// Bot loop
async function botLoop() {
    while (running) {
        try {
            let closes = await fetchData();
            latestData = closes;
            let signal = checkSignal(closes);
            let price = closes[closes.length - 1];

            if (signal === 'BUY' && VIRTUAL_BALANCES.USD > 0) {
                let qty = (VIRTUAL_BALANCES.USD * tradeSizePercent / 100) / price;
                VIRTUAL_BALANCES.BTC += qty;
                VIRTUAL_BALANCES.USD -= qty * price;
                TRADE_LOG.push(`[${new Date().toLocaleTimeString()}] Bought ${qty.toFixed(6)} BTC at $${price.toFixed(2)}`);
                lastSignal = 'BUY';
            } else if (signal === 'SELL' && VIRTUAL_BALANCES.BTC > 0) {
                let qty = VIRTUAL_BALANCES.BTC * tradeSizePercent / 100;
                let amount = qty * price;
                VIRTUAL_BALANCES.BTC -= qty;
                VIRTUAL_BALANCES.USD += amount;
                TRADE_LOG.push(`[${new Date().toLocaleTimeString()}] Sold ${qty.toFixed(6)} BTC at $${price.toFixed(2)}`);
                lastSignal = 'SELL';
            } else lastSignal = 'NONE';

            // Broadcast updates to all clients
            io.emit('update', {
                usd: VIRTUAL_BALANCES.USD.toFixed(2),
                btc: VIRTUAL_BALANCES.BTC.toFixed(6),
                trades: TRADE_LOG.slice(-10).reverse(),
                data: latestData,
                ema9: EMA(latestData, 9),
                ema21: EMA(latestData, 21),
                rsi: RSI(latestData, 14),
                signal: lastSignal,
                running,
                tradeSizePercent
            });

        } catch (e) {
            console.log('Error:', e);
        }
        await new Promise(r => setTimeout(r, 60000));
    }
}

// Routes
app.get('/', (req, res) => res.render('index'));
app.post('/set-size', (req, res) => {
    let val = parseFloat(req.body.size);
    if (val > 0 && val <= 100) tradeSizePercent = val;
    res.redirect('/');
});
app.get('/start', (req, res) => {
    if (!running) { running = true; botLoop(); }
    res.redirect('/');
});
app.get('/stop', (req, res) => { running = false; res.redirect('/'); });

// Start server
server.listen(port, () => console.log(`Bot running at http://localhost:${port}`));
