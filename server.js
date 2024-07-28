const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 4000;

app.get('/screenshot', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log("Screenshot is being captured of url: ", url);
    const screenshot = await page.screenshot();
    await browser.close();

    res.set('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (err) {
    if (browser) {
      await browser.close();
    }
    console.error("the error is ",err);
    res.status(500).send('Error capturing screenshot');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
