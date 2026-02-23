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
   * Apply rune effects to mods (additive, multiplied by count).
   * The caller is responsible for enforcing per-rune limits.
   */
  function applyRuneToMods(mods, rune, count) {
    const out = { ...mods };
    const slots = Math.max(0, count | 0);
    if (!slots) return out;

    for (const [k, v] of Object.entries(rune)) {
      if (k === 'id' || k === 'name') continue;
      if (typeof v === 'number' && out[k] !== undefined) {
        out[k] = (out[k] ?? 0) + v * slots;
      }
    }
    return out;
  }

  /**
   * Compute best rune variant: strip rune mods, try each rune configuration, return highest DPS.
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

    // Pre-resolve rune refs for convenience
    const iron = RUNE_OPTIONS.find((r) => r.id === 'greater-iron');
    const summer = RUNE_OPTIONS.find((r) => r.id === 'thane-summer');
    const spring = RUNE_OPTIONS.find((r) => r.id === 'thane-spring');
    const quip = RUNE_OPTIONS.find((r) => r.id === 'quipolatl');

    let best = null;

    // Constraints:
    // - At most 1 Spring
    // - At most 1 Summer
    // - Remaining sockets can be Iron and/or Quipolatl
    for (let springCount = 0; springCount <= Math.min(1, runeSlotCount); springCount++) {
      for (let summerCount = 0; summerCount <= Math.min(1, runeSlotCount - springCount); summerCount++) {
        const remainingAfterSpringSummer = runeSlotCount - springCount - summerCount;
        for (let ironCount = 0; ironCount <= remainingAfterSpringSummer; ironCount++) {
          const quipCount = remainingAfterSpringSummer - ironCount;

          let modsWithRunes = { ...modsWithoutRunes };

          if (iron && ironCount > 0) {
            modsWithRunes = applyRuneToMods(modsWithRunes, iron, ironCount);
          }
          if (summer && summerCount > 0) {
            modsWithRunes = applyRuneToMods(modsWithRunes, summer, summerCount);
          }
          if (spring && springCount > 0) {
            modsWithRunes = applyRuneToMods(modsWithRunes, spring, springCount);
          }
          if (quip && quipCount > 0) {
            modsWithRunes = applyRuneToMods(modsWithRunes, quip, quipCount);
          }

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
            ...modsWithRunes,
          };

          const result = calcDps(input);
          // Use non-crit total DPS to match trade site's displayed DPS more closely.
          const dps = (result && typeof result.totalDps === 'number') ? result.totalDps : 0;

          if (!best || dps > best.dps) {
            best = {
              rune: {
                configuration: {
                  iron: ironCount,
                  summer: summerCount,
                  spring: springCount,
                  quip: quipCount,
                },
              },
              dps,
              modsWithRune: modsWithRunes,
            };
          }
        }
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
