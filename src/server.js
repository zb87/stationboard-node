require('dotenv').config();
const express = require('express');
const stationRouter = require('./routes/station');
const journeyRouter = require('./routes/journey');

const app = express();
const PORT = process.env.PORT || 3000;

// Routes
app.use('/station', stationRouter);
app.use('/journey', journeyRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Stationboard API proxy listening on http://localhost:${PORT}`);
});
