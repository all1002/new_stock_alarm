const axios = require('axios');

const stocks = ['AMKR', 'HIMX', 'ACLS', 'UCTT', 'VECO', 'NVTS', 'CAMT', 'SMCI'];
const API_KEY = 'YOUR_API_KEY';
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID';
const SECRET_KEY = 'all1002_4417';

const boughtStocks = {};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { secret_key } = req.query;
  if (secret_key !== SECRET_KEY) {
    return res.status(403).json({ message: 'Forbidden: Invalid secret key' });
  }

  try {
    const response = await axios.get(`https://api.twelvedata.com/quote?symbol=${stocks.join(',')}&apikey=${API_KEY}`);
    const data = response.data;
    const results = [];

    for (const symbol of stocks) {
      const stockData = data[symbol];
      if (!stockData || stockData.status === 'error') continue;

      const price = parseFloat(stockData.price) || null;
      const volume = parseFloat(stockData.volume) || null;
      const percentChange = parseFloat(stockData.percent_change) || null;
      const rsi = parseFloat(stockData.rsi) || null;

      results.push({ symbol, price, volume, percent_change: percentChange, rsi });
    }

    for (const stock of results) {
      if (stock.price === null) continue;

      const previous = boughtStocks[stock.symbol];
      if (!previous && stock.rsi !== null && stock.rsi <= 30) {
        boughtStocks[stock.symbol] = { buy_price: stock.price, highest_price: stock.price };
        await sendTelegram(`🚀 [매수 감지] ${stock.symbol} @ $${stock.price.toFixed(2)}`);
      }

      if (previous) {
        if (stock.price > previous.highest_price) {
          boughtStocks[stock.symbol].highest_price = stock.price;
        }

        const profitRate = ((stock.price - previous.buy_price) / previous.buy_price) * 100;
        const dropFromHigh = ((stock.price - previous.highest_price) / previous.highest_price) * 100;

        if (profitRate >= 20 || profitRate <= -5 || dropFromHigh <= -3 || stock.rsi >= 70) {
          await sendTelegram(`⚡ [매도 감지] ${stock.symbol} @ $${stock.price.toFixed(2)} | 수익률 ${profitRate.toFixed(2)}%`);
          delete boughtStocks[stock.symbol];
        }
      }
    }

    res.status(200).json({ count: results.length, stocks: results });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: 'Error fetching stock data or sending Telegram message.' });
  }
};

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown',
  }).catch(error => {
    console.error('Telegram Error:', error.response?.data || error.message);
  });
}
