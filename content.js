(function () {
  'use strict';

  const BADGE_DATA_ATTR = 'data-poe-value-evaluated';
  const APP = 'poe2deal';
  const PANEL_ID = `${APP}-panel`;
  const PANEL_LINK_CLASS = `${APP}-link`;
  const JUMP_FLASH_MS = 1800;

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

  function formatRuneConfiguration(config) {
    if (!config) return null;

    const parts = [];
    if (config.iron) parts.push(`${config.iron}x Greater Iron`);
    if (config.summer) parts.push(`${config.summer}x Thane Myrk's Summer`);
    if (config.spring) parts.push(`${config.spring}x Thane Leld's Spring`);
    if (config.quip) parts.push(`${config.quip}x Quipolatl`);
    if (!parts.length) return null;
    return parts.join(', ');
  }

  // ===== Panel + navigation helpers (poe2deal-style UI) =====
  function ensurePanel() {
    let p = document.getElementById(PANEL_ID);
    if (p) return p;
    p = document.createElement('div');
    p.id = PANEL_ID;
    p.textContent = 'poe2deal: loading…';
    document.documentElement.appendChild(p);
    return p;
  }

  function setPanel(html) {
    ensurePanel().innerHTML = html;
  }

  function jumpToRowById(id, fallbackIndex) {
    let row = null;
    if (id) {
      row =
        document.querySelector(`div.row[data-id="${CSS.escape(id)}"]`) ||
        document.querySelector(`[data-id="${CSS.escape(id)}"].row`);
    }

    if (!row && typeof fallbackIndex === 'number') {
      const rows = document.querySelectorAll('.row');
      row = rows[fallbackIndex] || null;
    }

    if (!row) return;

    row.scrollIntoView({ behavior: 'smooth', block: 'center' });

    row.classList.add(`${APP}-jumpflash`);
    const pb = row.querySelector('.right .price') || row.querySelector('.right .details');
    if (pb) pb.classList.add(`${APP}-jumpflash`);

    window.setTimeout(() => {
      row.classList.remove(`${APP}-jumpflash`);
      if (pb) pb.classList.remove(`${APP}-jumpflash`);
    }, JUMP_FLASH_MS);
  }

  function attachPanelClickHandler() {
    const p = ensurePanel();
    if (p.__poe2dealClickBound) return;
    p.__poe2dealClickBound = true;

    p.addEventListener('click', (e) => {
      const a =
        e.target && e.target.closest ? e.target.closest(`a.${PANEL_LINK_CLASS}`) : null;
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('data-id');
      const idxAttr = a.getAttribute('data-index');
      const idx =
        idxAttr != null && idxAttr !== '' && !Number.isNaN(Number(idxAttr))
          ? Number(idxAttr)
          : undefined;
      jumpToRowById(id, idx);
    });
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
          const runeSummary = formatRuneConfiguration(best.rune?.configuration);
          titleLines.push(
            '',
            runeSummary
              ? `Best runes (${parsed.runeSlotCount} slots): ${runeSummary}`
              : `Best runes (${parsed.runeSlotCount} slots)`,
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
    let bestRuneSummary = null;
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
          bestRuneSummary = formatRuneConfiguration(best.rune?.configuration);
        }
      }
    }

    const ratio = displayDps / price.amount;
    const id = row.getAttribute('data-id') || null;

    return {
      row,
      id,
      dps,
      displayDps,
      priceAmount: price.amount,
      priceCurrency: price.currency,
      currencyShort,
      ratio,
      bestRuneSummary,
      runeSlotCount,
    };
  }

  function renderTopList(entries) {
    if (!entries || entries.length === 0) return;

    ensurePanel();
    attachPanelClickHandler();

    const top = entries
      .slice()
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);

    if (top.length === 0) {
      return;
    }

    let html = `<b>Best DPS/Div (Top 5)</b><br>`;

    top.forEach((entry, i) => {
      const ratioText = entry.ratio.toFixed(2);
      const dpsText = entry.displayDps.toFixed(1);
      const priceText = `${entry.priceAmount} ${entry.priceCurrency}`;
      const runeText =
        entry.bestRuneSummary && entry.runeSlotCount > 0
          ? ` | Runes: ${entry.bestRuneSummary}`
          : '';

      const safeId = entry.id || '';
      const safeIndex =
        typeof entry.index === 'number' && Number.isFinite(entry.index)
          ? entry.index
          : '';

      html += `#${i + 1}: <a class="${PANEL_LINK_CLASS}" data-id="${safeId}" data-index="${safeIndex}"><b>${ratioText}</b></a> (${dpsText} DPS for ${priceText}${runeText})<br>`;
    });

    setPanel(html);
  }

  let processScheduled = false;

  function processAllRows() {
    const rows = document.querySelectorAll('.row');
    const evaluated = [];

    rows.forEach((row, index) => {
      const value = evaluateRowValue(row);
      if (value) {
        value.index = index;
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

  function scheduleProcessAllRows() {
    if (processScheduled) return;
    processScheduled = true;
    window.requestAnimationFrame(() => {
      processScheduled = false;
      processAllRows();
    });
  }

  function init() {
    const container = findResultsContainer();
    if (!container) {
      setTimeout(init, 500);
      return;
    }

    processAllRows();

    const observer = new MutationObserver(() => {
      scheduleProcessAllRows();
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
