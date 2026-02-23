/**
 * Best DPS rune options for martial weapons.
 * Used to compute "best variant" when all rune slots use the optimal rune.
 *
 * Sources: PoE2 Wiki, PoE2DB
 */

(function () {
  'use strict';

  /**
   * Rune options that boost DPS (martial weapons).
   * Per-slot stats; multiply by slot count when filling all slots.
   */
  const RUNE_OPTIONS = [
    {
      id: 'greater-iron',
      name: 'Greater Iron Rune',
      increasedPhys: 18,
    },
    {
      id: 'thane-summer',
      name: "Thane Myrk's Rune of Summer",
      flatFireMin: 23,
      flatFireMax: 34,
    },
    {
      id: 'thane-spring',
      name: "Thane Leld's Rune of Spring",
      flatLightningMin: 1,
      flatLightningMax: 60,
    },
    {
      id: 'quipolatl',
      name: 'Soul Core of Quipolatl',
      increasedAttackSpeed: 5,
    },
  ];

  /**
   * Apply rune effects to mods (additive, multiplied by slot count).
   */
  function applyRuneToMods(mods, rune, slotCount) {
    const out = { ...mods };
    for (const [k, v] of Object.entries(rune)) {
      if (k === 'id' || k === 'name') continue;
      if (typeof v === 'number' && out[k] !== undefined) {
        out[k] = (out[k] ?? 0) + v * slotCount;
      }
    }
    return out;
  }

  /**
   * Compute best rune variant: strip rune mods, try each rune in all slots, return highest DPS.
   *
   * @param {Object} base - Reverse-engineered base stats
   * @param {Object} mods - All modifiers (we'll subtract rune mods)
   * @param {Object} runeMods - Modifiers that come from runes only
   * @param {number} runeSlotCount - Number of rune slots
   * @param {Function} calcDps - (base, mods) => totalDps
   * @returns {{ rune: object, dps: number, mods: object }|null}
   */
  function computeBestRuneVariant(base, mods, runeMods, runeSlotCount, calcDps) {
    if (!runeSlotCount || runeSlotCount < 1) return null;

    const modsWithoutRunes = {
      flatPhysMin: (mods.flatPhysMin ?? 0) - (runeMods.flatPhysMin ?? 0),
      flatPhysMax: (mods.flatPhysMax ?? 0) - (runeMods.flatPhysMax ?? 0),
      flatFireMin: (mods.flatFireMin ?? 0) - (runeMods.flatFireMin ?? 0),
      flatFireMax: (mods.flatFireMax ?? 0) - (runeMods.flatFireMax ?? 0),
      flatColdMin: (mods.flatColdMin ?? 0) - (runeMods.flatColdMin ?? 0),
      flatColdMax: (mods.flatColdMax ?? 0) - (runeMods.flatColdMax ?? 0),
      flatLightningMin: (mods.flatLightningMin ?? 0) - (runeMods.flatLightningMin ?? 0),
      flatLightningMax: (mods.flatLightningMax ?? 0) - (runeMods.flatLightningMax ?? 0),
      flatChaosMin: (mods.flatChaosMin ?? 0) - (runeMods.flatChaosMin ?? 0),
      flatChaosMax: (mods.flatChaosMax ?? 0) - (runeMods.flatChaosMax ?? 0),
      increasedPhys: (mods.increasedPhys ?? 0) - (runeMods.increasedPhys ?? 0),
      increasedAttackSpeed: (mods.increasedAttackSpeed ?? 0) - (runeMods.increasedAttackSpeed ?? 0),
      quality: mods.quality ?? 0,
    };

    let best = null;
    for (const rune of RUNE_OPTIONS) {
      const modsWithRune = applyRuneToMods(modsWithoutRunes, rune, runeSlotCount);
      const input = {
        basePhysMin: base.basePhysMin,
        basePhysMax: base.basePhysMax,
        baseAps: base.baseAps,
        baseFireMin: base.baseFireMin ?? 0,
        baseFireMax: base.baseFireMax ?? 0,
        baseColdMin: base.baseColdMin ?? 0,
        baseColdMax: base.baseColdMax ?? 0,
        baseLightningMin: base.baseLightningMin ?? 0,
        baseLightningMax: base.baseLightningMax ?? 0,
        baseChaosMin: base.baseChaosMin ?? 0,
        baseChaosMax: base.baseChaosMax ?? 0,
        ...modsWithRune,
      };
      const result = calcDps(input);
      const dps = result?.totalDps ?? 0;
      if (!best || dps > best.dps) {
        best = { rune, dps, modsWithRune };
      }
    }
    return best;
  }

  if (typeof window !== 'undefined') {
    window.PoeValueEvaluator = window.PoeValueEvaluator || {};
    window.PoeValueEvaluator.runeOptions = {
      RUNE_OPTIONS,
      applyRuneToMods,
      computeBestRuneVariant,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      RUNE_OPTIONS,
      applyRuneToMods,
      computeBestRuneVariant,
    };
  }
})();
