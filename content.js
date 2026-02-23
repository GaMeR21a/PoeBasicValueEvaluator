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

  // ===== Iron rune projection math (from poe2deal userscript) =====
  const IRON_RUNE_PHYS_INC = 18; // 18% increased Physical Damage per iron rune

  function parseNum(txt) {
    const m = String(txt || '')
      .replace(/,/g, '')
      .match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }

  function parseRange(txt) {
    const s = String(txt || '').replace(/,/g, '');
    const m = s.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
    if (!m) return null;
    return { min: Number(m[1]), max: Number(m[3]) };
  }

  function avgRange(r) {
    if (!r) return null;
    return (r.min + r.max) / 2;
  }

  function parseEdps(row) {
    const el =
      row.querySelector('[data-field="edps"] .colourDefault') ||
      row.querySelector('[data-field="edps"]');
    if (!el) return null;
    return parseNum(el.textContent);
  }

  function parseQualityPct(row) {
    const q = row.querySelector('[data-field="quality"]');
    if (!q) return 0;
    const pct = parseNum(q.textContent);
    return Number.isFinite(pct) ? pct : 0;
  }

  function parsePhysDamageRange(row) {
    const p = row.querySelector('[data-field="pdamage"]');
    if (!p) return null;
    const txt = p.textContent || '';
    return parseRange(txt);
  }

  function parseAps(row) {
    const a = row.querySelector('[data-field="aps"]');
    if (!a) return null;
    const n = parseNum(a.textContent);
    return Number.isFinite(n) ? n : null;
  }

  // Sum all "% increased Physical Damage" EXCEPT quality (includes rune mods)
  function sumIncPhysPctNonQuality(row) {
    const nodes = Array.from(
      row.querySelectorAll('.itemBoxContent .content span, .itemBoxContent .content div')
    );

    let sum = 0;
    for (const n of nodes) {
      const t = (n.textContent || '').trim();
      if (!t) continue;
      if (/^Quality\s*:/i.test(t)) continue;
      const m = t.match(/(\d+(\.\d+)?)%\s*increased\s+Physical\s+Damage/i);
      if (m) sum += Number(m[1]);
    }
    return sum;
  }

  function sumRuneIncPhysPct(row) {
    const runeNodes = Array.from(row.querySelectorAll('.runeMod'));
    let sum = 0;
    for (const n of runeNodes) {
      const t = (n.textContent || '').trim();
      const m = t.match(/(\d+(\.\d+)?)%\s*increased\s+Physical\s+Damage/i);
      if (m) sum += Number(m[1]);
    }
    return sum;
  }

  function countRuneSlots(row) {
    const sockets = row.querySelectorAll('.iconContainer .sockets .socket--rune');
    if (sockets && sockets.length) return sockets.length;

    const s = row.querySelector('.iconContainer .sockets');
    if (s && s.classList) {
      for (const c of Array.from(s.classList)) {
        const m = c.match(/^numSockets(\d+)$/);
        if (m) return Number(m[1]);
      }
    }
    return 0;
  }

  // Compute projected total DPS after swapping ALL rune slots to iron runes,
  // by backing out base physical damage and re-applying new inc phys and quality.
  function projectDpsWithIronRunes(row) {
    const dps = getDps(row);
    const edps = parseEdps(row);

    const aps = parseAps(row);
    const physRange = parsePhysDamageRange(row);

    const qualityPct = parseQualityPct(row);
    const qualityMult = 1 + qualityPct / 100;

    const incPhysPct = sumIncPhysPctNonQuality(row); // includes current rune phys, excludes quality
    const incPhysMult = 1 + incPhysPct / 100;

    const runeIncPctCurrent = sumRuneIncPhysPct(row);
    const runeSlots = countRuneSlots(row);
    const runeIncPctProjected = runeSlots * IRON_RUNE_PHYS_INC;

    if (!aps || !physRange || !Number.isFinite(aps)) {
      return {
        ok: false,
        reason: 'missing aps/phys',
        dps,
        edps,
        runeSlots,
        projectedDps: null,
      };
    }

    const physAvg = avgRange(physRange);
    if (!Number.isFinite(physAvg) || physAvg <= 0) {
      return {
        ok: false,
        reason: 'bad phys avg',
        dps,
        edps,
        runeSlots,
        projectedDps: null,
      };
    }

    // Base physical average damage (removing all inc phys and quality)
    const basePhysAvg = physAvg / (incPhysMult * qualityMult);

    // Replace current rune phys inc with full iron runes
    const incPhysPctProjectedNonQuality =
      incPhysPct - runeIncPctCurrent + runeIncPctProjected;
    const incPhysMultProjected = 1 + incPhysPctProjectedNonQuality / 100;

    // Rebuild projected phys avg and then projected phys dps
    const physAvgProjected = basePhysAvg * incPhysMultProjected * qualityMult;
    const pdpsProjected = physAvgProjected * aps;

    const edpsSafe = Number.isFinite(edps) ? edps : 0;
    const dpsProjected = pdpsProjected + edpsSafe;

    return {
      ok: true,
      dps,
      edps: edpsSafe,
      runeSlots,
      projectedDps: dpsProjected,
    };
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

    const titleLines = [];

    titleLines.push(
      `Current: ${dps} DPS → ${(dps / price.amount).toFixed(2)}/${currencyShort}`
    );

    const ironProj = projectDpsWithIronRunes(row);
    if (ironProj?.ok && typeof ironProj.projectedDps === 'number') {
      const projected = ironProj.projectedDps;
      const runeSlots = ironProj.runeSlots ?? 0;
      titleLines.push(
        '',
        `All Iron runes (${runeSlots} slots):`,
        `  DPS: ${projected.toFixed(1)} → ${(projected / price.amount).toFixed(
          2
        )}/${currencyShort}`
      );
    }

    const effectiveDps =
      ironProj?.ok && typeof ironProj.projectedDps === 'number'
        ? ironProj.projectedDps
        : dps;
    const ratio = effectiveDps / price.amount;
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

    const currentDps = dps;
    const ironProj = projectDpsWithIronRunes(row);
    const runeSlotCount = ironProj?.runeSlots ?? 0;
    const bestDps =
      ironProj?.ok && typeof ironProj.projectedDps === 'number'
        ? ironProj.projectedDps
        : null;

    const effectiveDps = typeof bestDps === 'number' && bestDps > 0 ? bestDps : currentDps;
    const ratio = effectiveDps / price.amount;
    const id = row.getAttribute('data-id') || null;

    return {
      row,
      id,
      dps: currentDps,
      displayDps: effectiveDps,
      bestDps,
      priceAmount: price.amount,
      priceCurrency: price.currency,
      currencyShort,
      ratio,
      bestRuneSummary: bestDps ? `All Iron (${runeSlotCount} slots)` : null,
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
      const ratioText = entry.ratio.toFixed(2); // based on best-rune DPS
      const currentDpsText =
        typeof entry.dps === 'number' && Number.isFinite(entry.dps)
          ? entry.dps.toFixed(1)
          : '?';
      const bestDpsText = entry.displayDps.toFixed(1);
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

      html += `#${i + 1}: <a class="${PANEL_LINK_CLASS}" data-id="${safeId}" data-index="${safeIndex}"><b>${ratioText}</b></a> (${currentDpsText}→${bestDpsText} DPS for ${priceText}${runeText})<br>`;
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
