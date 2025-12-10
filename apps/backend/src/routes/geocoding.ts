import express from 'express';

const router = express.Router();

// Proxy endpoint for Nominatim geocoding (to avoid CORS issues)
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const encodedQuery = encodeURIComponent(q);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TripMatrix/1.0 (https://tripmatrix.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const results = await response.json();

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search location',
    });
  }
});

export default router;

