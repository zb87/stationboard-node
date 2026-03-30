require('dotenv').config();
const express = require('express');
const path = require('path');
const stationRouter = require('./routes/station');
const journeyRouter = require('./routes/journey');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve PWA production build
app.use(express.static(path.join(__dirname, '../web/dist')));

// Routes
app.use('/station', stationRouter);
app.use('/journey', journeyRouter);
app.use('/search', searchRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Stationboard API proxy listening on http://localhost:${PORT}`);
});
