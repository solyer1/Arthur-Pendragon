/**
 * HP & Combat Calculator Utilities
 * Supports arithmetic expressions (e.g. "12 + 15", "40 - 8"),
 * D&D dice notation (e.g. "2d8+4", "4d6", "1d10"),
 * damage absorption via shield/barrier, and damage multipliers.
 */

/**
 * Safely evaluates a math expression string containing numbers and + - * / ( )
 */
function safeMathEval(expr) {
  // Strip anything that is not digits, basic operators, parentheses, or decimal points
  const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
  if (!sanitized.trim()) return 0;
  try {
    // Using Function with sanitized characters only
    const result = Function(`"use strict"; return (${sanitized})`)();
    return typeof result === 'number' && !isNaN(result) && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

/**
 * Parses and evaluates an input string which may contain:
 * - Simple number: "25"
 * - Arithmetic: "15 + 10 * 2"
 * - Dice expression: "2d8 + 4", "4d6", "1d10"
 * 
 * @param {string|number} input 
 * @returns {{ value: number, raw: string, breakdown: string, isDice: boolean, isValid: boolean }}
 */
export function evaluateHpExpression(input) {
  if (input === null || input === undefined || input === '') {
    return { value: 0, raw: '', breakdown: '', isDice: false, isValid: true };
  }

  const str = String(input).trim();
  if (!str) {
    return { value: 0, raw: '', breakdown: '', isDice: false, isValid: true };
  }

  // Check for dice notation e.g. 2d8, d20, 3d10
  const diceRegex = /(\d*)d(\d+)/gi;
  let hasDice = false;
  const breakdowns = [];

  const replacedExpr = str.replace(diceRegex, (match, countStr, sidesStr) => {
    hasDice = true;
    const count = Math.min(50, Math.max(1, parseInt(countStr) || 1));
    const sides = Math.min(1000, Math.max(1, parseInt(sidesStr) || 6));
    const rolls = [];
    let sum = 0;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      sum += roll;
    }

    breakdowns.push(`${count}d${sides} [${rolls.join(', ')}] = ${sum}`);
    return sum;
  });

  const num = safeMathEval(replacedExpr);
  const finalValue = Math.max(0, Math.round(num));

  return {
    value: finalValue,
    raw: str,
    breakdown: breakdowns.join('; '),
    isDice: hasDice,
    isValid: !isNaN(finalValue)
  };
}

/**
 * Calculates damage resolution with shield absorption.
 * Shields absorb damage first; leftover damage reduces Current HP.
 */
export function applyHpDamage({
  currentHp = 0,
  shield = 0,
  amount = 0,
  multiplier = 1,
  minHp = 0
}) {
  const effectiveDmg = Math.max(0, Math.floor(amount * multiplier));
  const absorbed = Math.min(shield, effectiveDmg);
  const newShield = shield - absorbed;
  const residualDmg = effectiveDmg - absorbed;
  const newHp = Math.max(minHp, currentHp - residualDmg);
  const hpLost = currentHp - newHp;
  const brokeShield = shield > 0 && newShield === 0;

  return {
    newHp,
    newShield,
    effectiveDmg,
    absorbed,
    hpLost,
    brokeShield,
    isDowned: newHp <= 0
  };
}

/**
 * Calculates healing up to effective Max HP.
 */
export function applyHpHeal({
  currentHp = 0,
  maxHp = 100,
  amount = 0,
  multiplier = 1
}) {
  const effectiveHeal = Math.max(0, Math.floor(amount * multiplier));
  const newHp = Math.min(maxHp, currentHp + effectiveHeal);
  const healed = newHp - currentHp;

  return {
    newHp,
    healed,
    isFullHeal: newHp >= maxHp
  };
}

/**
 * Calculates shield addition.
 */
export function applyHpShield({
  currentShield = 0,
  amount = 0
}) {
  const added = Math.max(0, Math.floor(amount));
  const newShield = currentShield + added;
  return {
    newShield,
    added
  };
}
