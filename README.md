# PoE2 Weapon Value Evaluator

A Chrome extension that shows **DPS-to-cost ratio** for weapons on the [Path of Exile 2 trade site](https://www.pathofexile.com/trade2). Quickly compare weapon value when browsing listings.

## Features

- Parses total DPS and price from each weapon listing
- Calculates and displays `X.XX DPS/currency` (e.g., `2.33 DPS/div`)
- Works with infinite scroll (new rows are processed automatically)
- Only shows for weapons (items with DPS)
- Non-intrusive badge near the price

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `PoeValueEvaluator` folder

## Usage

1. Go to [pathofexile.com/trade2](https://www.pathofexile.com/trade2)
2. Search for weapons (bows, swords, wands, etc.)
3. Each listing shows a green badge with the DPS-to-cost ratio
4. Hover over the badge for the full calculation breakdown

## Example

- **465.75 DPS** / **200 divine** → badge shows `2.33 DPS/div`

## Files

- `manifest.json` - Extension manifest (Manifest V3)
- `content.js` - DOM parsing, ratio calculation, and badge injection
- `styles.css` - Badge styling
