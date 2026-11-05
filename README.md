# Delivery Operations Dashboard — standalone demo

A newly written static product demo with generated data. It contains no exported NoCode source, internal service connections, credentials, real merchant records or production data.

## Features

- City and delivery-area filters, metric cards and table views, hourly trend charts.
- Configurable target and safety margin; drag-and-drop metric selection.
- Merchant search, selection, configurable city-level surge rules.
- Simulated manual interventions with reasons, duration, notes and confirmation.
- Local intervention history, strategy overview, CSV exports.
- Responsive layout, panel collapse and expanded views.

All data are simulated. Changes are saved in the current browser's localStorage and are not shared between visitors. There is no live operations backend, AI model or actual prediction service. Chart series and strategy summary cards are illustrative; they are not calculated from the merchant table. A displayed intervention duration is metadata for demonstration and does not schedule a live action or expiry.

## Open locally

Open `index.html` in a modern browser. Alternatively, run a static file server in this folder:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a GitHub repository and upload `index.html`, `styles.css`, `app.js`, `.nojekyll` and this README to its root.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, choose **main**, choose **/(root)**, and save.
4. GitHub will show the website address after deployment, usually `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

No build command, package installation or secret is needed. Relative asset paths support GitHub Pages project sites. The optional Google Fonts stylesheet has system-font fallbacks.
