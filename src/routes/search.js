const express = require('express');

const router = express.Router();

const COMPLETION_API = 'https://search.ch/fahrplan/api/completion.json';

/**
 * GET /search
 *
 * Search for stations / stops.
 *
 * Query parameters (one of):
 *   - text     : search term (e.g. "Bern")
 *   - latlon   : "lat,lon" coordinate pair (e.g. "46.948004,7.448134")
 *   - accuracy : optional, meters – used together with latlon
 *
 * Returns an array of matching stations.
 */
router.get('/', async (req, res) => {
  const { text, latlon, accuracy } = req.query;

  if (!text && !latlon) {
    return res
      .status(400)
      .json({ error: 'Provide either "text" or "latlon" query parameter' });
  }

  try {
    const url = new URL(COMPLETION_API);
    url.searchParams.set('show_ids', '1');

    if (text) {
      url.searchParams.set('term', text);
    } else {
      url.searchParams.set('latlon', latlon);
      if (accuracy) {
        url.searchParams.set('accuracy', accuracy);
      }
    }

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`search.ch API error ${response.status}: ${body}`);
    }

    const results = await response.json();

    // Normalise into a clean list of stations
    const stations = results.map((item) => {
      const station = { label: item.label };
      if (item.id) station.id = item.id;
      if (item.iconclass) station.iconclass = item.iconclass;
      if (item.dist != null) station.dist = item.dist;
      return station;
    });

    res.json(stations);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
