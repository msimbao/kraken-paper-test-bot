const { v4: uuidv4 } = require('uuid');

// 10 crypto/USD pairs on Kraken
const PAIRS = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'XRP/USD',
  'DOT/USD', 'AVAX/USD', 'LINK/USD', 'MATIC/USD', 'LTC/USD'
];

const STRATEGIES = [
  'EMA-ADX-ATR',
  'BBands-RSI',
  'Donchian',
  'MACD-RSI',
  'Supertrend-HA'
];

class BotManager {
  constructor(io, startBal = 10000, leverage = 1) {
    this.io = io;
    this.startBal = startBal;
    this.leverage = leverage;
    this.pairs = {};
    this.tradeLog = [];

    PAIRS.forEach(pair => {
      this.pairs[pair] = {
        balances: { USD: startBal },
        strategies: {},
        history: []
      };
      STRATEGIES.forEach(s => {
        this.pairs[pair].strategies[s] = {
          balanceUSD: startBal,
          pnlPct: 0
        };
      });
    });

    this.running = false;
  }

  startAll() {
    this.running = true;
    PAIRS.forEach((pair, i) => {
      setTimeout(() => this.startPair(pair), i * 2000); // stagger start
    });
  }

  startPair(pair) {
    if (!this.running) return;
    setInterval(() => this.tick(pair), 10000); // every 10s for demo
  }

  tick(pair) {
    const snapshot = { strategies: {}, totalPct: 0, avgBalanceUSD: 0 };

    STRATEGIES.forEach(s => {
      const strat = this.pairs[pair].strategies[s];

      // mock price move
      const changePct = (Math.random() - 0.5) * 2;
      strat.pnlPct += changePct / 100;

      const newBal = this.startBal * (1 + strat.pnlPct) * this.leverage;
      strat.balanceUSD = newBal;

      snapshot.strategies[s] = {
        pnlPct: strat.pnlPct * 100,
        balanceUSD: newBal
      };

      this.tradeLog.push({
        id: uuidv4(),
        pair,
        strategy: s,
        entry: (1000 + Math.random() * 100).toFixed(2),
        exit: (1000 + Math.random() * 100).toFixed(2),
        entryTime: new Date(Date.now() - 10000).toISOString(),
        exitTime: new Date().toISOString(),
        profitUSD: (newBal - this.startBal).toFixed(2),
        profitPct: (strat.pnlPct * 100).toFixed(2)
      });
    });

    snapshot.totalPct = Object.values(snapshot.strategies)
      .reduce((a, b) => a + b.pnlPct, 0) / STRATEGIES.length;

    snapshot.avgBalanceUSD = Object.values(snapshot.strategies)
      .reduce((a, b) => a + b.balanceUSD, 0) / STRATEGIES.length;

    this.pairs[pair].history.push(snapshot);

    this.io.emit('update', { pair, snapshot, trades: this.tradeLog });
  }

  getState() {
    return {
      startBal: this.startBal,
      leverage: this.leverage,
      pairs: this.pairs,
      tradeLog: this.tradeLog
    };
  }

  loadState(data) {
    this.startBal = data.startBal;
    this.leverage = data.leverage;
    this.pairs = data.pairs;
    this.tradeLog = data.tradeLog || [];
  }

  resume() {
    this.running = true;
    PAIRS.forEach((pair, i) => {
      setTimeout(() => this.startPair(pair), i * 2000);
    });
  }

  updateSettings(startBal, leverage) {
    this.startBal = startBal;
    this.leverage = leverage;
  }
}

module.exports = BotManager;
