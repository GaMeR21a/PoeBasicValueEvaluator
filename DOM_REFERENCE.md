# PoE 2 Trade Site – Weapon DOM Structure

Reference for parsing weapon listings from pathofexile.com/trade2.

## Row structure

```html
<div class="row" data-id="...">
  <div class="left">...</div>
  <div class="middle">
    <div class="itemPopupContainer">
      <div class="itemBoxContent">...</div>
    </div>
    <div class="itemPopupAdditional">
      <!-- DPS summary -->
    </div>
  </div>
  <div class="right">
    <div class="details">
      <div class="price">...</div>
    </div>
  </div>
</div>
```

## Stats (inside itemBoxContent)

| data-field | Example        | Description                  |
|-----------|----------------|------------------------------|
| quality   | +20%           | Quality (affects phys dmg)    |
| pdamage   | 289-521        | Physical Damage min-max      |
| crit      | 9.19%          | Critical Hit Chance          |
| aps       | 1.15           | Attacks per Second           |
| dps       | 465.75         | Total DPS (in itemPopupAdditional) |
| pdps      | 465.75         | Physical DPS                 |
| edps      | 0              | Elemental DPS (hidden when 0) |

## Modifier elements

- `.runeMod` – Rune stats (e.g. 18% increased Physical Damage)
- `.explicitMod` – Explicit affixes
- `.implicitMod` – Implicit (e.g. 50% reduced Projectile Range)
- Desecrated: `[data-field="stat.desecrated.stat_..."]` (e.g. 17% increased Attack Speed)

All mod text lives in spans with `[data-field^="stat."]` (stat.explicit, stat.rune, stat.implicit, stat.desecrated). Examples:
- `18% increased Physical Damage`
- `162% increased Physical Damage`
- `Adds 24 to 40 Physical Damage`
- `Gain 20% of Damage as Extra Lightning Damage`
- `+4.19% to Critical Hit Chance`
- `+3 to Level of all Attack Skills`

## Example: Obliterator Bow

```
Quality: +20%
Physical Damage: 289-521
Critical Hit Chance: 9.19%
Attacks per Second: 1.15
DPS: 465.75

Runes: 18% inc phys, +1 arrow, projectile speed, broken armour
Explicit: 162% inc phys, +24-40 phys, Gain 20% as lightning, +4.19% crit
```
