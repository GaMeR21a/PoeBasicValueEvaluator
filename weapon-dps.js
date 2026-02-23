/**
 * Path of Exile 2 Weapon DPS Formulas
 *
 * Forward: Calculate DPS from base weapon stats + modifiers.
 * Reverse: Derive base weapon stats from final displayed values + known modifiers.
 *
 * Sources:
 * - PoE 2 Wiki: Modifier, Quality, Weapon
 * - Mobalytics: Damage & Defence Order of Operations
 */

// =============================================================================
// TYPES / INTERFACES
// =============================================================================

/**
 * @typedef {Object} WeaponInputs
 * @property {number} basePhysMin - Base weapon physical min (from base type)
 * @property {number} basePhysMax - Base weapon physical max (from base type)
 * @property {number} baseAps - Base attacks per second (from base type)
 * @property {number} [baseCritChance=5] - Base crit chance (e.g. 5 for 5%)
 * @property {number} [baseCritMulti=1.5] - Base crit multiplier (1.5 = 150%)
 * @property {number} [flatPhysMin=0]
 * @property {number} [flatPhysMax=0]
 * @property {number} [flatFireMin=0]
 * @property {number} [flatFireMax=0]
 * @property {number} [flatColdMin=0]
 * @property {number} [flatColdMax=0]
 * @property {number} [flatLightningMin=0]
 * @property {number} [flatLightningMax=0]
 * @property {number} [flatChaosMin=0]
 * @property {number} [flatChaosMax=0]
 * @property {number} [increasedPhys=0] - e.g. 50 for 50%
 * @property {number} [increasedAttackSpeed=0] - e.g. 12 for 12%
 * @property {number} [flatCritChance=0] - e.g. 2 for +2%
 * @property {number} [quality=0] - e.g. 20 for 20%
 */

/**
 * @typedef {Object} WeaponOutputs
 * @property {number} physDps
 * @property {number} eleDps
 * @property {number} totalDps
 * @property {number} totalDpsWithCrit
 * @property {number} physMin
 * @property {number} physMax
 * @property {number} aps
 */

/**
 * @typedef {Object} FinalWeaponStats
 * @property {number} physMin - Final displayed physical min
 * @property {number} physMax - Final displayed physical max
 * @property {number} [fireMin=0]
 * @property {number} [fireMax=0]
 * @property {number} [coldMin=0]
 * @property {number} [coldMax=0]
 * @property {number} [lightningMin=0]
 * @property {number} [lightningMax=0]
 * @property {number} [chaosMin=0]
 * @property {number} [chaosMax=0]
 * @property {number} aps - Final displayed attacks per second
 */

/**
 * @typedef {Object} KnownModifiers
 * @property {number} [flatPhysMin=0]
 * @property {number} [flatPhysMax=0]
 * @property {number} [flatFireMin=0]
 * @property {number} [flatFireMax=0]
 * @property {number} [flatColdMin=0]
 * @property {number} [flatColdMax=0]
 * @property {number} [flatLightningMin=0]
 * @property {number} [flatLightningMax=0]
 * @property {number} [flatChaosMin=0]
 * @property {number} [flatChaosMax=0]
 * @property {number} [increasedPhys=0]
 * @property {number} [increasedAttackSpeed=0]
 * @property {number} [quality=0]
 */

/**
 * @typedef {Object} BaseWeaponStats
 * @property {number} basePhysMin
 * @property {number} basePhysMax
 * @property {number} baseAps
 * @property {number} [baseFireMin=0]
 * @property {number} [baseFireMax=0]
 * @property {number} [baseColdMin=0]
 * @property {number} [baseColdMax=0]
 * @property {number} [baseLightningMin=0]
 * @property {number} [baseLightningMax=0]
 * @property {number} [baseChaosMin=0]
 * @property {number} [baseChaosMax=0]
 */

// =============================================================================
// FORWARD: Base + Modifiers → Final DPS
// =============================================================================

/**
 * Calculate weapon DPS from base stats and modifiers.
 *
 * Order of operations:
 * 1. Flat physical = base + all flat (affixes, runes)
 * 2. × (1 + increased physical%)
 * 3. × (1 + quality%) — Quality applies last as "more" multiplier
 * 4. Elemental: flat only (no local scaling on weapons)
 * 5. APS = base APS × (1 + increased attack speed%)
 *
 * @param {WeaponInputs} input
 * @returns {WeaponOutputs}
 */
function calcWeaponDps(input) {
  const flatPhysMin = (input.flatPhysMin ?? 0) + (input.basePhysMin ?? 0);
  const flatPhysMax = (input.flatPhysMax ?? 0) + (input.basePhysMax ?? 0);

  const increasedPhysMult = 1 + (input.increasedPhys ?? 0) / 100;
  let physMin = flatPhysMin * increasedPhysMult;
  let physMax = flatPhysMax * increasedPhysMult;

  const qualityMult = 1 + (input.quality ?? 0) / 100;
  physMin *= qualityMult;
  physMax *= qualityMult;

  const fireMin = (input.baseFireMin ?? 0) + (input.flatFireMin ?? 0);
  const fireMax = (input.baseFireMax ?? 0) + (input.flatFireMax ?? 0);
  const coldMin = (input.baseColdMin ?? 0) + (input.flatColdMin ?? 0);
  const coldMax = (input.baseColdMax ?? 0) + (input.flatColdMax ?? 0);
  const lightningMin = (input.baseLightningMin ?? 0) + (input.flatLightningMin ?? 0);
  const lightningMax = (input.baseLightningMax ?? 0) + (input.flatLightningMax ?? 0);
  const chaosMin = (input.baseChaosMin ?? 0) + (input.flatChaosMin ?? 0);
  const chaosMax = (input.baseChaosMax ?? 0) + (input.flatChaosMax ?? 0);

  const aps = (input.baseAps ?? 0) * (1 + (input.increasedAttackSpeed ?? 0) / 100);

  const avgPhys = (physMin + physMax) / 2;
  const avgFire = (fireMin + fireMax) / 2;
  const avgCold = (coldMin + coldMax) / 2;
  const avgLightning = (lightningMin + lightningMax) / 2;
  const avgChaos = (chaosMin + chaosMax) / 2;

  const physDps = avgPhys * aps;
  const eleDps = (avgFire + avgCold + avgLightning + avgChaos) * aps;
  const totalDps = physDps + eleDps;

  const critChance = ((input.baseCritChance ?? 5) + (input.flatCritChance ?? 0)) / 100;
  const critMulti = input.baseCritMulti ?? 1.5;
  const critFactor = 1 + critChance * (critMulti - 1);
  const totalDpsWithCrit = totalDps * critFactor;

  return {
    physDps,
    eleDps,
    totalDps,
    totalDpsWithCrit,
    physMin,
    physMax,
    aps,
  };
}

// =============================================================================
// REVERSE: Final displayed values + known modifiers → Base weapon stats
// =============================================================================

/**
 * Reverse-engineer base weapon stats from final displayed values.
 *
 * Use when you have the item's displayed damage/APS (e.g. from tooltip or trade)
 * and know the modifiers (affixes, runes, quality). Solves for the base weapon
 * that would produce those final values.
 *
 * Physical: final = (base + flat) × (1 + increased%) × (1 + quality%)
 *   → base = final / [(1 + increased%) × (1 + quality%)] - flat
 *
 * Elemental: final = base + flat (no local scaling)
 *   → base = final - flat
 *
 * APS: final = base × (1 + increased%)
 *   → base = final / (1 + increased%)
 *
 * @param {FinalWeaponStats} final - Final displayed values from the item
 * @param {KnownModifiers} mods - Known modifier values (affixes, runes, quality)
 * @returns {BaseWeaponStats}
 */
function reverseEngineerBase(final, mods = {}) {
  const increasedPhys = mods.increasedPhys ?? 0;
  const quality = mods.quality ?? 0;
  const increasedAttackSpeed = mods.increasedAttackSpeed ?? 0;

  const physScale = (1 + increasedPhys / 100) * (1 + quality / 100);
  const apsScale = 1 + increasedAttackSpeed / 100;

  const basePhysMin =
    (final.physMin ?? 0) / physScale - (mods.flatPhysMin ?? 0);
  const basePhysMax =
    (final.physMax ?? 0) / physScale - (mods.flatPhysMax ?? 0);

  const baseAps = (final.aps ?? 0) / apsScale;

  // Elemental: no local scaling, so base = final - flat
  const baseFireMin = (final.fireMin ?? 0) - (mods.flatFireMin ?? 0);
  const baseFireMax = (final.fireMax ?? 0) - (mods.flatFireMax ?? 0);
  const baseColdMin = (final.coldMin ?? 0) - (mods.flatColdMin ?? 0);
  const baseColdMax = (final.coldMax ?? 0) - (mods.flatColdMax ?? 0);
  const baseLightningMin =
    (final.lightningMin ?? 0) - (mods.flatLightningMin ?? 0);
  const baseLightningMax =
    (final.lightningMax ?? 0) - (mods.flatLightningMax ?? 0);
  const baseChaosMin = (final.chaosMin ?? 0) - (mods.flatChaosMin ?? 0);
  const baseChaosMax = (final.chaosMax ?? 0) - (mods.flatChaosMax ?? 0);

  return {
    basePhysMin,
    basePhysMax,
    baseAps,
    baseFireMin,
    baseFireMax,
    baseColdMin,
    baseColdMax,
    baseLightningMin,
    baseLightningMax,
    baseChaosMin,
    baseChaosMax,
  };
}

/**
 * Verify reverse engineering by running forward calc and comparing to final.
 * Useful for testing/debugging.
 *
 * @param {FinalWeaponStats} final
 * @param {KnownModifiers} mods
 * @returns {{ base: BaseWeaponStats, reconstructed: WeaponOutputs, matches: boolean }}
 */
function reverseAndVerify(final, mods) {
  const base = reverseEngineerBase(final, mods);
  const reconstructed = calcWeaponDps({
    basePhysMin: base.basePhysMin,
    basePhysMax: base.basePhysMax,
    baseAps: base.baseAps,
    baseFireMin: base.baseFireMin,
    baseFireMax: base.baseFireMax,
    baseColdMin: base.baseColdMin,
    baseColdMax: base.baseColdMax,
    baseLightningMin: base.baseLightningMin,
    baseLightningMax: base.baseLightningMax,
    baseChaosMin: base.baseChaosMin,
    baseChaosMax: base.baseChaosMax,
    flatPhysMin: mods.flatPhysMin ?? 0,
    flatPhysMax: mods.flatPhysMax ?? 0,
    flatFireMin: mods.flatFireMin ?? 0,
    flatFireMax: mods.flatFireMax ?? 0,
    flatColdMin: mods.flatColdMin ?? 0,
    flatColdMax: mods.flatColdMax ?? 0,
    flatLightningMin: mods.flatLightningMin ?? 0,
    flatLightningMax: mods.flatLightningMax ?? 0,
    flatChaosMin: mods.flatChaosMin ?? 0,
    flatChaosMax: mods.flatChaosMax ?? 0,
    increasedPhys: mods.increasedPhys ?? 0,
    increasedAttackSpeed: mods.increasedAttackSpeed ?? 0,
    quality: mods.quality ?? 0,
  });

  const epsilon = 0.01;
  const physMatches =
    Math.abs(reconstructed.physMin - (final.physMin ?? 0)) < epsilon &&
    Math.abs(reconstructed.physMax - (final.physMax ?? 0)) < epsilon;
  const apsMatches = Math.abs(reconstructed.aps - (final.aps ?? 0)) < epsilon;

  return {
    base,
    reconstructed,
    matches: physMatches && apsMatches,
  };
}

// =============================================================================
// EXPORTS (for use in extension or tests)
// =============================================================================

if (typeof window !== 'undefined') {
  window.PoeValueEvaluator = window.PoeValueEvaluator || {};
  window.PoeValueEvaluator.weaponDps = { calcWeaponDps, reverseEngineerBase, reverseAndVerify };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcWeaponDps,
    reverseEngineerBase,
    reverseAndVerify,
  };
}
