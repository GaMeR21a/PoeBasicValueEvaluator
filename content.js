(function () {
  'use strict';

  const BADGE_DATA_ATTR = 'data-poe-value-evaluated';

  /**
   * Extract DPS value from a row. DPS is in [data-field="dps"].
   * Structure: <span data-field="dps">DPS<span class="colourDefault">465.75</span></span>
   */
  function getDps(row) {
    const dpsEl = row.querySelector('[data-field="dps"]');
    if (!dpsEl) return null;
    const valueEl = dpsEl.querySelector('.colourDefault, .colourAugmented') || dpsEl;
    const text = (valueEl.textContent || '').trim();
    const num = parseFloat(text.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? null : num;
  }

  /**
   * Extract price amount and currency from [data-field="price"].
   * Structure: <span data-field="price">...<span>200</span><span>×</span><span class="currency-text">...Divine Orb</span></span>
   */
  function getPrice(row) {
    const priceEl = row.querySelector('[data-field="price"]');
    if (!priceEl) return null;
    const spans = priceEl.querySelectorAll('span');
    let amount = null;
    let currency = null;
    for (const span of spans) {
      const text = (span.textContent || '').trim();
      if (/^\d+(\.\d+)?$/.test(text) && !span.querySelector('img')) {
        amount = parseFloat(text);
        break;
      }
    }
    const currencyImg = priceEl.querySelector('.currency-text img, img[title]');
    if (currencyImg && currencyImg.title) {
      currency = currencyImg.title.toLowerCase();
    } else {
      const currencyText = priceEl.querySelector('.currency-text span');
      if (currencyText) {
        currency = (currencyText.textContent || '').trim().toLowerCase().replace(/\s+orb$/i, '');
      }
    }
    if (amount == null || amount <= 0 || !currency) return null;
    return { amount, currency };
  }

  /**
   * Check if this row is a weapon (has DPS field).
   */
  function isWeapon(row) {
    return row.querySelector('[data-field="dps"]') != null;
  }

  /**
   * Format currency for display (e.g., "divine" -> "div", "chaos" -> "chaos").
   */
  function formatCurrency(currency) {
    if (!currency) return '?';
    const short = { divine: 'div', chaos: 'chaos', exalted: 'ex', mirror: 'mirror' };
    return short[currency] || currency.slice(0, 3);
  }

  function processRow(row) {
    if (row.getAttribute(BADGE_DATA_ATTR) === 'true') return;
    if (!isWeapon(row)) return;

    const dps = getDps(row);
    const price = getPrice(row);
    if (dps == null || !price) return;

    const currencyShort = formatCurrency(price.currency);

    const rightPanel = row.querySelector('.right .details');
    if (!rightPanel) return;

    const priceDiv = rightPanel.querySelector('.price');

    let badge = rightPanel.querySelector('.poe-value-evaluator-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'poe-value-evaluator-badge';
      if (priceDiv && priceDiv.nextSibling) {
        rightPanel.insertBefore(badge, priceDiv.nextSibling);
      } else {
        rightPanel.appendChild(badge);
      }
    }

    let displayDps = dps;
    const titleLines = [];

    const parsed = window.PoeValueEvaluator?.weaponParser?.parseAndReverseEngineer?.(row);
    if (parsed?.base) {
      const { basePhysMin, basePhysMax, baseAps } = parsed.base;
      titleLines.push(
        `Current: ${dps} DPS → ${(dps / price.amount).toFixed(2)}/${currencyShort}`,
        '',
        'Base (pre-mods):',
        `  Phys: ${Math.round(basePhysMin)}-${Math.round(basePhysMax)}`,
        `  APS: ${baseAps.toFixed(2)}`
      );

      const ro = window.PoeValueEvaluator?.runeOptions;
      const wp = window.PoeValueEvaluator?.weaponDps;
      if (ro?.computeBestRuneVariant && wp?.calcWeaponDps && parsed.runeSlotCount > 0) {
        const best = ro.computeBestRuneVariant(
          parsed.base,
          parsed.mods,
          parsed.runeMods ?? {},
          parsed.runeSlotCount,
          (input) => wp.calcWeaponDps(input)
        );
        if (best) {
          displayDps = best.dps;
          titleLines.push(
            '',
            `Best rune (${parsed.runeSlotCount} slots): ${best.rune.name}`,
            `  DPS: ${best.dps.toFixed(1)} → ${(best.dps / price.amount).toFixed(2)}/${currencyShort}`
          );
        }
      }
    } else {
      titleLines.push(
        `${dps} DPS ÷ ${price.amount} ${price.currency} = ${(dps / price.amount).toFixed(2)}`
      );
    }

    const ratio = displayDps / price.amount;
    badge.textContent = `${ratio.toFixed(2)} DPS/${currencyShort}`;
    badge.title = titleLines.join('\n');

    row.setAttribute(BADGE_DATA_ATTR, 'true');
  }

  function evaluateRowValue(row) {
    if (!isWeapon(row)) return null;

    const dps = getDps(row);
    const price = getPrice(row);
    if (dps == null || !price) return null;

    const currencyShort = formatCurrency(price.currency);

    let displayDps = dps;
    const parsed = window.PoeValueEvaluator?.weaponParser?.parseAndReverseEngineer?.(row);
    let bestRune = null;
    let runeSlotCount = 0;

    if (parsed?.base) {
      const ro = window.PoeValueEvaluator?.runeOptions;
      const wp = window.PoeValueEvaluator?.weaponDps;
      runeSlotCount = parsed.runeSlotCount ?? 0;
      if (ro?.computeBestRuneVariant && wp?.calcWeaponDps && runeSlotCount > 0) {
        const best = ro.computeBestRuneVariant(
          parsed.base,
          parsed.mods,
          parsed.runeMods ?? {},
          runeSlotCount,
          (input) => wp.calcWeaponDps(input)
        );
        if (best) {
          displayDps = best.dps;
          bestRune = best.rune?.name || null;
        }
      }
    }

    const ratio = displayDps / price.amount;

    return {
      row,
      dps,
      displayDps,
      priceAmount: price.amount,
      priceCurrency: price.currency,
      currencyShort,
      ratio,
      bestRune,
      runeSlotCount,
    };
  }

  function renderTopList(entries) {
    if (!entries || entries.length === 0) return;

    const container = findResultsContainer();
    if (!container) return;

    let box = container.querySelector('.poe-value-evaluator-toplist');
    if (!box) {
      box = document.createElement('div');
      box.className = 'poe-value-evaluator-toplist';
      if (container.firstChild) {
        container.insertBefore(box, container.firstChild);
      } else {
        container.appendChild(box);
      }
    }

    const top = entries
      .slice()
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);

    if (top.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.style.display = '';
    box.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'poe-value-evaluator-toplist__title';
    titleEl.textContent = 'Top 5 DPS per Div';
    box.appendChild(titleEl);

    const listEl = document.createElement('ol');
    listEl.className = 'poe-value-evaluator-toplist__list';
    box.appendChild(listEl);

    top.forEach((entry) => {
      const itemEl = document.createElement('li');
      itemEl.className = 'poe-value-evaluator-toplist__item';

      const ratioText = `${entry.ratio.toFixed(2)} DPS/${entry.currencyShort}`;
      const dpsText = `${entry.displayDps.toFixed(1)} DPS`;
      const priceText = `${entry.priceAmount} ${entry.priceCurrency}`;

      let label = `${ratioText} — ${dpsText} for ${priceText}`;
      if (entry.bestRune && entry.runeSlotCount > 0) {
        label += ` (Best rune: ${entry.bestRune}, ${entry.runeSlotCount} slots)`;
      }

      itemEl.textContent = label;

      itemEl.addEventListener('click', () => {
        try {
          entry.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          entry.row.classList.add('poe-value-evaluator-toplist__highlight');
          setTimeout(() => {
            entry.row.classList.remove('poe-value-evaluator-toplist__highlight');
          }, 1500);
        } catch (e) {
          // ignore scroll errors
        }
      });

      listEl.appendChild(itemEl);
    });
  }

  function processAllRows() {
    const rows = document.querySelectorAll('.row');
    const evaluated = [];

    rows.forEach((row) => {
      const value = evaluateRowValue(row);
      if (value) {
        evaluated.push(value);
      }

      if (row.getAttribute(BADGE_DATA_ATTR) !== 'true') {
        processRow(row);
      }
    });

    renderTopList(evaluated);
  }

  function findResultsContainer() {
    return (
      document.querySelector('.search-results') ||
      document.querySelector('[class*="result"]') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function init() {
    const container = findResultsContainer();
    if (!container) {
      setTimeout(init, 500);
      return;
    }

    processAllRows();

    const observer = new MutationObserver(() => {
      processAllRows();
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
