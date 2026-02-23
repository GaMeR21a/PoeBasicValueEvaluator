/**
 * Parse weapon listing HTML from PoE 2 trade site.
 * Extracts final stats and modifiers for DPS calculation / base reverse-engineering.
 *
 * DOM structure reference (from trade site):
 * - Row: .row (contains left/middle/right)
 * - Item popup: .itemPopupContainer .itemBoxContent (inside .middle)
 * - Stats: [data-field="quality"], [data-field="pdamage"], [data-field="crit"], [data-field="aps"]
 * - Modifiers: .runeMod, .explicitMod, .implicitMod, .desecratedMod; or [data-field^="stat."] spans
 * - Summary: .itemPopupAdditional has [data-field="dps"], [data-field="pdps"], [data-field="edps"]
 */

(function () {
  'use strict';

  const FIELD = {
    QUALITY: 'quality',
    PDAMAGE: 'pdamage',
    CRIT: 'crit',
    APS: 'aps',
    DPS: 'dps',
    PDPS: 'pdps',
    EDPS: 'edps',
  };

  /**
   * Parse a number from text like "289-521", "20%", "1.15", "465.75"
   */
  function parseNum(text) {
    if (!text || typeof text !== 'string') return null;
    const n = parseFloat(text.replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  }

  /**
   * Parse "X-Y" range from text like "289-521" or "24 to 40"
   */
  function parseRange(text) {
    if (!text || typeof text !== 'string') return { min: null, max: null };
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
    if (!match) return { min: null, max: null };
    return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
  }

  /**
   * Get text from a data-field element. Looks for .colourDefault, .colourAugmented, or uses own text.
   */
  function getFieldText(root, field) {
    const el = root.querySelector(`[data-field="${field}"]`);
    if (!el) return null;
    const valueEl = el.querySelector('.colourDefault, .colourAugmented') || el;
    return (valueEl.textContent || '').trim() || null;
  }

  /**
   * Extract final weapon stats from item popup DOM.
   *
   * @param {Element} itemRoot - Container with item content (e.g. .itemBoxContent or .itemPopupContainer)
   * @returns {import('./weapon-dps.js').FinalWeaponStats | null}
   */
  function parseFinalStats(itemRoot) {
    const root = itemRoot.closest('.itemPopupContainer') || itemRoot;

    const pdamageText = getFieldText(root, FIELD.PDAMAGE);
    const apsText = getFieldText(root, FIELD.APS);
    if (!pdamageText || !apsText) return null;

    const physRange = parseRange(pdamageText);
    const aps = parseNum(apsText);
    if (physRange.min == null || physRange.max == null || aps == null) return null;

    const result = {
      physMin: physRange.min,
      physMax: physRange.max,
      aps,
      fireMin: 0,
      fireMax: 0,
      coldMin: 0,
      coldMax: 0,
      lightningMin: 0,
      lightningMax: 0,
      chaosMin: 0,
      chaosMax: 0,
    };

    return result;
  }

  /**
   * Parse modifier text into structured form.
   * Examples:
   *   "18% increased Physical Damage" -> { increasedPhys: 18 }
   *   "162% increased Physical Damage" -> { increasedPhys: 162 }
   *   "Adds 24 to 40 Physical Damage" -> { flatPhysMin: 24, flatPhysMax: 40 }
   *   "Adds 5 to 138 Fire Damage" -> { flatFireMin: 5, flatFireMax: 138 }
   *   "Gain 20% of Damage as Extra Lightning Damage" -> (handled separately, not in base calc)
   */
  const MOD_REGEX = {
    increasedPhys: /(\d+(?:\.\d+)?)\s*%\s*increased\s+Physical\s+Damage/i,
    increasedAttackSpeed: /(\d+(?:\.\d+)?)\s*%\s*increased\s+Attack\s+Speed/i,
    flatPhys: /Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+Physical\s+Damage/i,
    flatFire: /Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+Fire\s+Damage/i,
    flatCold: /Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+Cold\s+Damage/i,
    flatLightning: /Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+Lightning\s+Damage/i,
    flatChaos: /Adds\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+Chaos\s+Damage/i,
  };

  function parseModText(text) {
    const out = {};
    if (!text || typeof text !== 'string') return out;

    const mIncPhys = text.match(MOD_REGEX.increasedPhys);
    if (mIncPhys) out.increasedPhys = (out.increasedPhys ?? 0) + parseFloat(mIncPhys[1]);

    // Aggregate all "X% increased Attack Speed" (exclude Companion/Minion/Ally mods)
    const mIncAps = text.match(MOD_REGEX.increasedAttackSpeed);
    if (mIncAps && !/Companions|Minions|Allies|have\s+\d/.test(text)) {
      out.increasedAttackSpeed = (out.increasedAttackSpeed ?? 0) + parseFloat(mIncAps[1]);
    }

    const mFlatPhys = text.match(MOD_REGEX.flatPhys);
    if (mFlatPhys) {
      out.flatPhysMin = (out.flatPhysMin ?? 0) + parseFloat(mFlatPhys[1]);
      out.flatPhysMax = (out.flatPhysMax ?? 0) + parseFloat(mFlatPhys[2]);
    }

    const mFlatFire = text.match(MOD_REGEX.flatFire);
    if (mFlatFire) {
      out.flatFireMin = (out.flatFireMin ?? 0) + parseFloat(mFlatFire[1]);
      out.flatFireMax = (out.flatFireMax ?? 0) + parseFloat(mFlatFire[2]);
    }

    const mFlatCold = text.match(MOD_REGEX.flatCold);
    if (mFlatCold) {
      out.flatColdMin = (out.flatColdMin ?? 0) + parseFloat(mFlatCold[1]);
      out.flatColdMax = (out.flatColdMax ?? 0) + parseFloat(mFlatCold[2]);
    }

    const mFlatLightning = text.match(MOD_REGEX.flatLightning);
    if (mFlatLightning) {
      out.flatLightningMin = (out.flatLightningMin ?? 0) + parseFloat(mFlatLightning[1]);
      out.flatLightningMax = (out.flatLightningMax ?? 0) + parseFloat(mFlatLightning[2]);
    }

    const mFlatChaos = text.match(MOD_REGEX.flatChaos);
    if (mFlatChaos) {
      out.flatChaosMin = (out.flatChaosMin ?? 0) + parseFloat(mFlatChaos[1]);
      out.flatChaosMax = (out.flatChaosMax ?? 0) + parseFloat(mFlatChaos[2]);
    }

    return out;
  }

  /**
   * Parse rune slot count from item. Looks for .sockets.numSocketsN or .socket--rune count.
   */
  function parseRuneSlotCount(itemRoot) {
    const container = itemRoot.closest('.row') || itemRoot;

    const socketsEl = container.querySelector('.sockets');
    if (socketsEl) {
      const numMatch = socketsEl.className.match(/numSockets(\d+)/);
      if (numMatch) return parseInt(numMatch[1], 10);
      const runeSockets = socketsEl.querySelectorAll('.socket--rune');
      if (runeSockets.length > 0) return runeSockets.length;
    }

    return 2;
  }

  /**
   * Parse modifiers from rune stats only (stat.rune.*).
   */
  function parseRuneModifiers(itemRoot) {
    const root = itemRoot.closest('.itemPopupContainer') || itemRoot;

    const mods = {
      flatPhysMin: 0,
      flatPhysMax: 0,
      flatFireMin: 0,
      flatFireMax: 0,
      flatColdMin: 0,
      flatColdMax: 0,
      flatLightningMin: 0,
      flatLightningMax: 0,
      flatChaosMin: 0,
      flatChaosMax: 0,
      increasedPhys: 0,
      increasedAttackSpeed: 0,
    };

    const runeStatSpans = root.querySelectorAll('[data-field^="stat.rune."]');
    for (const span of runeStatSpans) {
      const text = (span.textContent || '').trim();
      const parsed = parseModText(text);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && mods[k] !== undefined) {
          mods[k] += v;
        }
      }
    }

    return mods;
  }

  /**
   * Extract known modifiers from rune + explicit mods.
   *
   * @param {Element} itemRoot
   * @returns {import('./weapon-dps.js').KnownModifiers}
   */
  function parseModifiers(itemRoot) {
    const root = itemRoot.closest('.itemPopupContainer') || itemRoot;

    const mods = {
      flatPhysMin: 0,
      flatPhysMax: 0,
      flatFireMin: 0,
      flatFireMax: 0,
      flatColdMin: 0,
      flatColdMax: 0,
      flatLightningMin: 0,
      flatLightningMax: 0,
      flatChaosMin: 0,
      flatChaosMax: 0,
      increasedPhys: 0,
      increasedAttackSpeed: 0,
      quality: 0,
    };

    const qualityText = getFieldText(root, FIELD.QUALITY);
    if (qualityText) {
      const q = parseNum(qualityText);
      if (q != null) mods.quality = q;
    }

    // Aggregate ALL mods: rune, explicit, implicit, desecrated, enchant.
    // Use stat spans (data-field^="stat.") to catch every mod type including desecrated.
    const statSpans = root.querySelectorAll('[data-field^="stat."]');
    for (const span of statSpans) {
      const text = (span.textContent || '').trim();
      const parsed = parseModText(text);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && mods[k] !== undefined) {
          mods[k] += v;
        }
      }
    }

    return mods;
  }

  /**
   * Find the item content root within a row. Trade site may use different structures.
   *
   * @param {Element} row - .row element
   * @returns {Element|null} Root element containing stats and mods
   */
  function findItemRoot(row) {
    return (
      row.querySelector('.itemPopupContainer') ||
      row.querySelector('.itemBoxContent') ||
      row.querySelector('.content') ||
      (() => {
        const pdamage = row.querySelector('[data-field="pdamage"]');
        return pdamage?.closest('.itemPopupContainer, .itemBoxContent, .content') || null;
      })()
    );
  }

  /**
   * Parse a weapon row and return final stats + modifiers for reverse-engineering.
   *
   * @param {Element} row - .row element
   * @returns {{ final: object, mods: object, runeMods: object, runeSlotCount: number } | null}
   */
  function parseWeaponRow(row) {
    const root = findItemRoot(row);
    if (!root) return null;

    const final = parseFinalStats(root);
    if (!final) return null;

    const mods = parseModifiers(root);
    const runeMods = parseRuneModifiers(root);
    const runeSlotCount = parseRuneSlotCount(root);
    return { final, mods, runeMods, runeSlotCount };
  }

  /**
   * Parse a weapon row and reverse-engineer base stats.
   * Requires weapon-dps.js to be loaded first.
   *
   * @param {Element} row - .row element
   * @returns {{ final: object, mods: object, base: object } | null}
   */
  function parseAndReverseEngineer(row) {
    const parsed = parseWeaponRow(row);
    if (!parsed) return null;
    const wp = typeof window !== 'undefined' && window.PoeValueEvaluator?.weaponDps;
    if (!wp) return parsed;
    const base = wp.reverseEngineerBase(parsed.final, parsed.mods);
    return { ...parsed, base };
  }

  if (typeof window !== 'undefined') {
    window.PoeValueEvaluator = window.PoeValueEvaluator || {};
    window.PoeValueEvaluator.weaponParser = {
      parseFinalStats,
      parseModifiers,
      parseWeaponRow,
      parseAndReverseEngineer,
      parseModText,
      parseRange,
      parseNum,
      getFieldText,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseFinalStats,
      parseModifiers,
      parseWeaponRow,
      parseModText,
    };
  }
})();
