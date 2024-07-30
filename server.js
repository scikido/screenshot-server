const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 4000;

// Use the CORS middleware
app.use(cors());

// Create a cache instance with a TTL (time-to-live) of 1 hour (3600 seconds)
const screenshotCache = new NodeCache({ stdTTL: 3600 });

app.get('/screenshot', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  // Check if the screenshot is already cached
  const cachedScreenshot = screenshotCache.get(url);
  if (cachedScreenshot) {
    console.log(`Cache hit for URL: ${url}`);
    res.set('Content-Type', 'image/png');
    return res.send(cachedScreenshot);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log("Screenshot is being captured of url: ", url);
    const screenshot = await page.screenshot();
    await browser.close();

    // Store the screenshot in the cache
    screenshotCache.set(url, screenshot);

    res.set('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (err) {
    if (browser) {
      await browser.close();
    }
    console.log("Error capturing screenshot of url: ", err);
    res.status(500).send('Error capturing screenshot');
    console.error(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
