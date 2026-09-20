import React, { useState, useMemo } from 'react';
import {
  Heart, Shield, Swords, Plus, Minus, Zap, RotateCcw,
  Sparkles, Calculator, Flame, AlertTriangle, Check, X,
  Dices, ArrowRight
} from 'lucide-react';
import {
  evaluateHpExpression,
  applyHpDamage,
  applyHpHeal,
  applyHpShield
} from '../utils/hpCalculator';

export default function HpCalculator({
  currentHp,
  setCurrentHp,
  maxHp,
  shield = 0,
  setShield,
  onLog = () => {},
  onNotify = () => {},
  compact = false
}) {
  const [calcInput, setCalcInput] = useState('');
  const [multiplier, setMultiplier] = useState(1.0);
  const [lastEval, setLastEval] = useState(null);

  // Compute HP percentage and status
  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100))) : 0;
  const shieldPercent = maxHp > 0 ? Math.min(100, Math.round((shield / maxHp) * 100)) : 0;

  // HP Color thresholding
  const hpColor = useMemo(() => {
    if (hpPercent > 60) return 'var(--accent-green, #10b981)';
    if (hpPercent > 25) return 'var(--accent-gold, #f59e0b)';
    return 'var(--accent-red, #ef4444)';
  }, [hpPercent]);

  // HP Status label
  const hpStatus = useMemo(() => {
    if (currentHp <= 0) return { label: 'Downed / Dead', color: '#ef4444', icon: AlertTriangle };
    if (hpPercent <= 25) return { label: 'Critical (<25%)', color: '#ef4444', icon: Flame };
    if (hpPercent <= 50) return { label: 'Bloodied (<50%)', color: '#f59e0b', icon: Swords };
    if (hpPercent < 100) return { label: 'Injured', color: '#60a5fa', icon: Shield };
    return { label: 'Full Health', color: '#10b981', icon: Check };
  }, [currentHp, hpPercent]);

  // Live preview evaluation
  const preview = useMemo(() => {
    if (!calcInput.trim()) return null;
    const evaluated = evaluateHpExpression(calcInput);
    if (!evaluated.isValid || evaluated.value === 0) return null;

    const baseAmount = evaluated.value;
    const effectiveDmg = Math.max(0, Math.floor(baseAmount * multiplier));
    const dmgResult = applyHpDamage({
      currentHp,
      shield,
      amount: baseAmount,
      multiplier,
      minHp: 0
    });

    const healResult = applyHpHeal({
      currentHp,
      maxHp,
      amount: baseAmount,
      multiplier: 1
    });

    return {
      evaluated,
      effectiveDmg,
      dmgResult,
      healResult
    };
  }, [calcInput, multiplier, currentHp, maxHp, shield]);

  // Handle Dealing Damage
  const handleDealDamage = (customAmount = null, customMult = null) => {
    const rawVal = customAmount !== null ? customAmount : calcInput;
    const activeMult = customMult !== null ? customMult : multiplier;

    if (!rawVal && customAmount === null) {
      onNotify('Please enter a damage amount or dice expression (e.g. 25 or 2d8+4)', 'error');
      return;
    }

    const evalResult = evaluateHpExpression(rawVal);
    if (!evalResult.isValid || evalResult.value <= 0) {
      onNotify('Invalid damage expression', 'error');
      return;
    }

    setLastEval(evalResult);

    const res = applyHpDamage({
      currentHp,
      shield,
      amount: evalResult.value,
      multiplier: activeMult,
      minHp: 0
    });

    // Update state
    setShield(res.newShield);
    setCurrentHp(res.newHp);

    // Build descriptive message
    const multStr = activeMult !== 1.0 ? ` (${activeMult}x multiplier)` : '';
    const diceStr = evalResult.breakdown ? ` [${evalResult.breakdown}]` : '';
    let logMsg = `Took ${res.effectiveDmg} Dmg${multStr}${diceStr}`;

    if (res.absorbed > 0) {
      logMsg += ` — Shield absorbed ${res.absorbed} (Shield: ${shield} → ${res.newShield})`;
    }
    if (res.hpLost > 0) {
      logMsg += ` — HP: ${currentHp} → ${res.newHp}`;
    } else if (res.absorbed > 0) {
      logMsg += ` — HP untouched!`;
    }

    if (res.brokeShield) {
      logMsg += ` 🛡️ Shield shattered!`;
      onNotify('🛡️ Shield was completely shattered!', 'warning');
    } else if (res.newHp <= 0) {
      onNotify('💀 Character has fallen to 0 HP!', 'error');
    } else {
      onNotify(
        res.hpLost > 0
          ? `Took ${res.hpLost} HP damage (${res.absorbed > 0 ? `${res.absorbed} absorbed` : 'unshielded'})`
          : `Shield absorbed all ${res.absorbed} damage!`,
        'success'
      );
    }

    onLog(logMsg);
    setCalcInput('');
  };

  // Handle Healing
  const handleHeal = (customAmount = null) => {
    const rawVal = customAmount !== null ? customAmount : calcInput;

    if (!rawVal && customAmount === null) {
      onNotify('Please enter a heal amount or dice expression (e.g. 20 or 2d8)', 'error');
      return;
    }

    const evalResult = evaluateHpExpression(rawVal);
    if (!evalResult.isValid || evalResult.value <= 0) {
      onNotify('Invalid heal expression', 'error');
      return;
    }

    setLastEval(evalResult);

    const res = applyHpHeal({
      currentHp,
      maxHp,
      amount: evalResult.value,
      multiplier: 1
    });

    if (res.healed <= 0) {
      onNotify(`HP is already full (${maxHp}/${maxHp})!`, 'info');
      return;
    }

    setCurrentHp(res.newHp);

    const diceStr = evalResult.breakdown ? ` [${evalResult.breakdown}]` : '';
    const logMsg = `Healed +${res.healed} HP${diceStr} — HP: ${currentHp} → ${res.newHp}`;

    onLog(logMsg);
    onNotify(`Healed +${res.healed} HP! (${res.newHp}/${maxHp})`, 'success');
    setCalcInput('');
  };

  // Handle Adding Shield
  const handleAddShield = (amount) => {
    const evalResult = evaluateHpExpression(amount);
    if (!evalResult.isValid || evalResult.value <= 0) return;

    const res = applyHpShield({ currentShield: shield, amount: evalResult.value });
    setShield(res.newShield);

    const logMsg = `Gained +${res.added} Shield (Total: ${res.newShield} Shield)`;
    onLog(logMsg);
    onNotify(`+${res.added} Shield Barrier added!`, 'success');
    setCalcInput('');
  };

  // Quick 1 HP micro-adjust
  const adjustHpDelta = (delta) => {
    if (delta > 0) {
      setCurrentHp(prev => Math.min(maxHp, prev + delta));
    } else {
      setCurrentHp(prev => Math.max(0, prev + delta));
    }
  };

  const StatusIcon = hpStatus.icon;

  return (
    <div className={`hp-calc-card card ${compact ? 'hp-calc-compact' : ''}`}>
      {/* ===== TOP BAR: HP & SHIELD METRICS ===== */}
      <div className="hp-calc-header">
        <div className="hp-calc-title-group">
          <div className="hp-calc-badge-icon" style={{ backgroundColor: `${hpColor}22`, color: hpColor }}>
            <Heart size={20} />
          </div>
          <div>
            <div className="hp-calc-title">
              Health & Damage Calculator
            </div>
            <div className="hp-calc-status" style={{ color: hpStatus.color }}>
              <StatusIcon size={12} style={{ display: 'inline', marginRight: 4 }} />
              {hpStatus.label} · {hpPercent}% HP
              {shield > 0 && <span style={{ color: '#38bdf8', marginLeft: 8 }}>· 🛡️ {shield} Barrier</span>}
            </div>
          </div>
        </div>

        {/* Big Numbers Display */}
        <div className="hp-calc-numbers">
          <div className="hp-main-digits">
            <button
              className="counter-btn"
              title="Decrease 1 HP"
              onClick={() => adjustHpDelta(-1)}
            >
              −
            </button>
            <span className="hp-digit-current" style={{ color: hpColor }}>
              {currentHp}
            </span>
            <span className="hp-digit-sep">/</span>
            <span className="hp-digit-max">{maxHp}</span>
            <button
              className="counter-btn"
              title="Increase 1 HP"
              onClick={() => adjustHpDelta(1)}
            >
              +
            </button>
          </div>

          {shield > 0 && (
            <div className="shield-active-pill" title="Active Damage Absorption Barrier">
              <Shield size={14} />
              <span>+{shield} Shield</span>
              <button
                className="shield-clear-btn"
                title="Reset/Break Shield"
                onClick={() => {
                  setShield(0);
                  onLog('Shield was dismissed / reset to 0');
                  onNotify('Shield barrier dismissed', 'info');
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== HEALTH & SHIELD PROGRESS BAR ===== */}
      <div className="hp-bar-container">
        <div className="hp-bar-track">
          {/* Base HP Fill */}
          <div
            className="hp-bar-fill"
            style={{
              width: `${hpPercent}%`,
              background: hpColor,
              boxShadow: `0 0 10px ${hpColor}66`
            }}
          />
          {/* Shield Overlay/Bar */}
          {shield > 0 && (
            <div
              className="hp-bar-shield"
              style={{
                width: `${Math.min(100, shieldPercent)}%`,
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.7)'
              }}
              title={`Shield Barrier: ${shield} HP (${shieldPercent}%)`}
            />
          )}
        </div>
        <div className="hp-bar-meta">
          <span>0 HP</span>
          <span>{shield > 0 ? `Shield: ${shield} HP` : `${hpPercent}%`}</span>
          <span>{maxHp} Max HP</span>
        </div>
      </div>

      {/* ===== CALCULATOR CONTROLS ===== */}
      <div className="hp-calc-controls">
        {/* Expression Input Box */}
        <div className="hp-input-row">
          <div className="hp-input-wrapper">
            <div className="hp-input-icon">
              <Calculator size={18} />
            </div>
            <input
              type="text"
              className="hp-calc-text-input"
              placeholder="Enter damage or heal (e.g. 25, 2d8+4, 15+10)..."
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleDealDamage();
                }
              }}
            />
            {calcInput && (
              <button
                className="hp-input-clear-btn"
                title="Clear input"
                onClick={() => setCalcInput('')}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="hp-btn-group">
            <button
              className="btn btn-calc-damage"
              onClick={() => handleDealDamage()}
              title="Apply Damage (Absorbs via Shield first, then decreases HP)"
            >
              <Swords size={16} />
              <span>− Damage</span>
            </button>

            <button
              className="btn btn-calc-heal"
              onClick={() => handleHeal()}
              title="Heal HP (Increases HP up to Max)"
            >
              <Heart size={16} />
              <span>+ Heal</span>
            </button>

            <button
              className="btn btn-calc-shield"
              onClick={() => handleAddShield(calcInput || '20')}
              title="Add temporary Hit Points / Shield Barrier"
            >
              <Shield size={16} />
              <span>+ Shield</span>
            </button>
          </div>
        </div>

        {/* Live Calculation Preview */}
        {preview && (
          <div className="hp-calc-preview animate-fade-in">
            <div className="preview-label">
              <Sparkles size={14} style={{ color: 'var(--accent-gold)' }} />
              <span>Calculation Preview:</span>
            </div>
            <div className="preview-content">
              {preview.evaluated.isDice && (
                <span className="preview-dice">
                  <Dices size={13} /> {preview.evaluated.breakdown}
                </span>
              )}
              <span className="preview-effective">
                Effective: <strong>{preview.effectiveDmg} Dmg</strong>
                {multiplier !== 1 && ` (${multiplier}x)`}
              </span>
              <span className="preview-arrow">
                <ArrowRight size={13} />
              </span>
              <span className="preview-outcome">
                {preview.dmgResult.absorbed > 0 && (
                  <span style={{ color: '#38bdf8', marginRight: 6 }}>
                    Shield absorbs {preview.dmgResult.absorbed} (Rem: {preview.dmgResult.newShield})
                  </span>
                )}
                <span style={{ color: preview.dmgResult.hpLost > 0 ? '#ef4444' : '#10b981' }}>
                  HP: {currentHp} → {preview.dmgResult.newHp}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Damage Multiplier Pills */}
        <div className="hp-multiplier-row">
          <span className="multiplier-title">Dmg Mod:</span>
          <div className="multiplier-pills">
            <button
              type="button"
              className={`mult-pill ${multiplier === 1.0 ? 'active' : ''}`}
              onClick={() => setMultiplier(1.0)}
              title="Normal Damage (1.0x)"
            >
              1.0x Normal
            </button>
            <button
              type="button"
              className={`mult-pill ${multiplier === 0.5 ? 'active' : ''}`}
              onClick={() => setMultiplier(0.5)}
              title="Resisted / Half Damage"
            >
              0.5x Resist
            </button>
            <button
              type="button"
              className={`mult-pill ${multiplier === 1.5 ? 'active' : ''}`}
              onClick={() => setMultiplier(1.5)}
              title="Critical Hit (1.5x)"
            >
              1.5x Crit
            </button>
            <button
              type="button"
              className={`mult-pill ${multiplier === 2.0 ? 'active' : ''}`}
              onClick={() => setMultiplier(2.0)}
              title="Vulnerable / Double Damage"
            >
              2.0x Vuln
            </button>
          </div>
        </div>

        {/* Quick Value Chips */}
        <div className="hp-chips-row">
          <div className="chip-group">
            <span className="chip-title">Dmg:</span>
            {[-5, -10, -20, -50].map(val => (
              <button
                key={val}
                className="hp-chip hp-chip-dmg"
                onClick={() => handleDealDamage(Math.abs(val))}
              >
                {val}
              </button>
            ))}
          </div>

          <div className="chip-group">
            <span className="chip-title">Heal:</span>
            {[5, 10, 20, 50].map(val => (
              <button
                key={val}
                className="hp-chip hp-chip-heal"
                onClick={() => handleHeal(val)}
              >
                +{val}
              </button>
            ))}
          </div>

          <div className="chip-group">
            <button
              className="hp-chip hp-chip-shield"
              onClick={() => handleAddShield(20)}
              title="Add 20 Shield Barrier"
            >
              🛡️ +20 Shield
            </button>
            <button
              className="hp-chip hp-chip-shield"
              onClick={() => handleAddShield(50)}
              title="Add 50 Shield Barrier"
            >
              🛡️ +50 Shield
            </button>
            <button
              className="hp-chip hp-chip-util"
              onClick={() => {
                setCurrentHp(maxHp);
                onLog(`Fully recovered to ${maxHp} Max HP`);
                onNotify(`HP restored to full (${maxHp})!`, 'success');
              }}
              title="Restore to 100% Max HP"
            >
              <RotateCcw size={11} style={{ marginRight: 3 }} /> Full Heal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
