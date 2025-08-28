const socket = io();

function fmtPct(n){
  return (typeof n === 'number' && !isNaN(n)) ? n.toFixed(2) + '%' : '-';
}
function fmtUSD(n){
  return (typeof n === 'number' && !isNaN(n)) ? '$' + n.toFixed(2) : '-';
}

document.getElementById('startBtn').onclick = () => {
  socket.emit('start', {
    startBal: parseFloat(document.getElementById('startBal').value),
    leverage: parseFloat(document.getElementById('leverage').value)
  });
};

document.getElementById('resumeBtn').onclick = () => {
  socket.emit('resume');
};

document.getElementById('settingsForm').onsubmit = (e) => {
  e.preventDefault();
  socket.emit('applySettings', {
    startBal: parseFloat(document.getElementById('startBal').value),
    leverage: parseFloat(document.getElementById('leverage').value)
  });
};

document.getElementById('showSummary').onclick = () => {
  document.getElementById('summaryView').style.display = '';
  document.getElementById('tradesView').style.display = 'none';
};
document.getElementById('showTrades').onclick = () => {
  document.getElementById('summaryView').style.display = 'none';
  document.getElementById('tradesView').style.display = '';
};

socket.on('update', ({ pair, snapshot, trades }) => {
  const body = document.getElementById('pairsBody');
  let row = document.getElementById(`row-${pair.replace('/', '-')}`);
  if (!row) {
    row = document.createElement('tr');
    row.id = `row-${pair.replace('/', '-')}`;
    row.innerHTML = `<td>${pair}</td>` +
      `<td class="s1"></td><td class="s2"></td><td class="s3"></td>` +
      `<td class="s4"></td><td class="s5"></td><td class="total"></td><td class="bal"></td>`;
    body.appendChild(row);
  }
  row.querySelector('.s1').textContent = fmtPct(snapshot.strategies['EMA-ADX-ATR']?.pnlPct);
  row.querySelector('.s2').textContent = fmtPct(snapshot.strategies['BBands-RSI']?.pnlPct);
  row.querySelector('.s3').textContent = fmtPct(snapshot.strategies['Donchian']?.pnlPct);
  row.querySelector('.s4').textContent = fmtPct(snapshot.strategies['MACD-RSI']?.pnlPct);
  row.querySelector('.s5').textContent = fmtPct(snapshot.strategies['Supertrend-HA']?.pnlPct);
  row.querySelector('.total').textContent = fmtPct(snapshot.totalPct);
  row.querySelector('.bal').textContent = fmtUSD(snapshot.avgBalanceUSD);

  const tBody = document.getElementById('tradesBody');
  tBody.innerHTML = '';
  trades.slice(-50).forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${t.pair}</td><td>${t.strategy}</td><td>${t.entry}</td><td>${t.exit}</td>` +
      `<td>${t.entryTime}</td><td>${t.exitTime}</td>` +
      `<td>${fmtUSD(parseFloat(t.profitUSD))}</td>` +
      `<td>${t.profitPct}%</td>`;
    tBody.appendChild(tr);
  });
});
