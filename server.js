const express = require('express');
const puppeteer = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 4000;

// Use the CORS middleware
app.use(cors());

// Create a cache instance with a TTL (time-to-live) of 1 hour (3600 seconds)
const screenshotCache = new NodeCache({ stdTTL: 3600 });

let cluster;

(async () => {
  // Launch Puppeteer Cluster
  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 4, // Adjust based on your server capacity
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // Define a task for taking screenshots
  await cluster.task(async ({ page, data: url }) => {
    // Set up page to disable loading unnecessary resources (keep fonts and images)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blockedResources = ['media'];
      if (blockedResources.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Emulate dark theme
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

    // Go to the URL and take a screenshot
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log("Screenshot is being captured of url: ", url);
    const screenshot = await page.screenshot();

    // Cache the screenshot
    screenshotCache.set(url, screenshot);
    return screenshot;
  });

  // Define the screenshot endpoint
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

    try {
      // Add the URL to the cluster queue and get the screenshot
      const screenshot = await cluster.execute(url);
      res.set('Content-Type', 'image/png');
      res.send(screenshot);
    } catch (err) {
      console.log("Error capturing screenshot of url: ", err);
      res.status(500).send('Error capturing screenshot');
    }
  });

  // Start the Express server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
})();

// Properly close the cluster when the Node.js process ends
process.on('exit', async () => {
  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
});