# Delivery Operations Dashboard — standalone demo

A newly written static product demo with generated data. It contains no exported NoCode source, internal service connections, credentials, real merchant records or production data.

## Features

- City and delivery-area filters, metric cards and table views, hourly trend charts.
- Configurable target and safety margin; drag-and-drop metric selection.
- Merchant search, selection, configurable city-level surge rules.
- Simulated manual interventions with reasons, duration, notes and confirmation.
- Local intervention history, strategy overview, CSV exports.
- Responsive layout, panel collapse and expanded views.

All data are simulated. Changes are saved in the current browser's localStorage and are not shared between visitors. There is no live operations backend, AI model or actual prediction service. Chart series and strategy summary cards are illustrative; they are not calculated from the merchant table. Intervention status (Pending/Ongoing/Expired/Cancelled) is calculated in the browser from the configured effective period. It does not schedule any real operation.

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

## Metric Pool update

The editor includes 40 numeric metrics and 13 charts, searchable by type; Core and multiple named sections support drag selection, reordering, moving, removal, and clearing. Confirm saves the layout locally; Cancel discards draft edits. Target, hourly ATA, real-time ATA, and Safety Margin remain fixed in Core.

AI Custom Metric recreates the definition, optional Mild/Moderate/Severe thresholds, preview, and add-to-pool workflow. This standalone version uses a local preview generator, not a connected AI service. Arithmetic formulas using built-in metric names and + - * / parentheses calculate against synthetic values; natural-language definitions are retained with simulated values. Custom metrics and section settings persist in this browser.

## Secondary-page audit update

- Delivery Area supports multiple selection; Metrics switches to per-area rows, including ATA sparklines, weather hints and active merchant/strategy drilldowns.
- Edit opens Tier grouping: add, rename, delete, assign, remove, clear and search unassigned areas. Drafts are discarded on Cancel.
- City and Tier ATA targets have Weekday, Rainy Weekday, Weekend and Rainy Weekend settings, each with target/warn/alert values. Tiers can inherit the city defaults.
- ATA Hourly shows a horizontally scrollable 24-hour heatmap grouped by Tier / Area. A scenario selector previews the four saved configurations. Dashboard uses the current weekday/weekend no-rain scenario; weather is simulated.
- Rules include six metrics and three severity thresholds, per-row restore and validation. City-level editing and area-level read-only views are supported.
- Intervention settings include shrink presets, ETA presets/custom positive integer, reason/custom text, notes, now/scheduled start, preset/custom end time, and reopening behavior for paused merchants. Review supports Back.
- Manual history includes details and CSV download. Active manual strategies can be edited/cancelled; system strategies are read-only.
- Strategy Merchant view groups actual demo actions and opens an affected merchant list from the count. Metrics CSV includes selected custom metrics.
- Module collapse/fullscreen and drag reordering, metric pool/sections, and chart hover values remain available.

Verification: browser checks covered target validation, saving/inheritance, Tier draft cancellation, 24-hour table, threshold order/restore, area read-only rules, multi-area rows, scheduled pause with custom end time and reopening choice, review/confirm/history, manual edit entry, affected merchant list, city switching and metric pool regression. No browser script errors were observed.
