import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DescriptionList from './DescriptionList';
import TooltipText from './TooltipText';
import { RotateCcw, Zap, Clock, SkipForward, Swords, Shield, Wind, Heart, Plus, Minus } from 'lucide-react';

/* ===== Helper: parse cost string like "8 [Sovereign Will]" ===== */
function parseCostFromDesc(desc) {
  if (!desc) return null;
  // Flatten array description to a single string for parsing
  const flat = flattenDesc(desc);
  const match = flat.match(/(\d+)\s*\[(.+?)\]/);
  if (match) return { amount: parseInt(match[1]), status: match[2] };
  return null;
}

function parseCost(costStr) {
  if (!costStr) return null;
  const match = costStr.match(/(\d+)\s*\[(.+?)\]/);
  if (match) return { amount: parseInt(match[1]), status: match[2] };
  return null;
}

/* ===== Helper: flatten description to string ===== */
function flattenDesc(desc) {
  if (typeof desc === 'string') return desc;
  if (!Array.isArray(desc)) return '';
  return desc.map(item => {
    if (typeof item === 'string') return item;
    if (item && item.text) return item.text + ' ' + flattenDesc(item.children || []);
    return '';
  }).join(' ');
}

/* ===== Helper: parse cooldown string ===== */
function parseCooldown(cdStr) {
  if (!cdStr) return 0;
  const match = cdStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/* ===== Helper: check if description has "Requird [StatusName]" ===== */
function parseRequiredStatus(desc) {
  const flat = flattenDesc(desc);
  if (!flat) return null;
  const match = flat.match(/[Rr]equir[de]+\s*\[(.+?)\]/);
  if (match) return match[1];
  return null;
}

/* ===== Notification Component ===== */
const Notification = ({ message, type }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, x: 0 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 30 }}
    transition={{ duration: 0.25 }}
    className={`notification notification-${type}`}
  >
    {message}
  </motion.div>
);

/* ===== Main PlaySheet Component ===== */
const PlaySheet = ({ data }) => {
  const { stats, passives, uniqueStatus, skills, weapons, runes } = data;

  // Merge all usable skills
  const allSkills = React.useMemo(() => {
    const arr = [];
    skills.forEach(s => arr.push({ ...s, source: 'skill' }));
    weapons.forEach(w => {
      w.skills.forEach(ws => arr.push({ ...ws, source: 'weapon', weaponName: w.name }));
    });
    runes.forEach(r => arr.push({ ...r, source: 'rune', cooldown: null }));
    return arr;
  }, [skills, weapons, runes]);

  // ===== GAME STATE =====
  const [turn, setTurn] = useState(1);
  const [currentHp, setCurrentHp] = useState(stats.health);
  const [maxHp, setMaxHp] = useState(stats.health);
  const [cooldowns, setCooldowns] = useState(() => {
    const cd = {};
    allSkills.forEach(s => { cd[s.name] = 0; });
    return cd;
  });
  const [statusCounters, setStatusCounters] = useState(() => {
    const sc = {};
    uniqueStatus.forEach(s => { sc[s.name] = 0; });
    return sc;
  });
  const [activeStatuses, setActiveStatuses] = useState(() => {
    const as = {};
    uniqueStatus.forEach(s => { as[s.name] = false; });
    return as;
  });
  const [notifications, setNotifications] = useState([]);
  const [log, setLog] = useState([]);
  const [swQuickAdd, setSwQuickAdd] = useState(5);
  const [activeDurations, setActiveDurations] = useState({});

  // ===== NOTIFICATIONS =====
  const notify = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [`[Turn ${turn}] ${msg}`, ...prev].slice(0, 50));
  }, [turn]);

  // ===== END TURN =====
  const handleEndTurn = () => {
    setCooldowns(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k] > 0) next[k] -= 1;
      });
      return next;
    });
    setStatusCounters(prev => {
      const next = { ...prev };
      if (next['Sovereign Will'] !== undefined) {
        next['Sovereign Will'] = Math.min((next['Sovereign Will'] || 0) + 1, 30);
      }
      return next;
    });

    let expired = [];
    setActiveDurations(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k] > 0) {
          next[k] -= 1;
          if (next[k] === 0) expired.push(k);
        }
      });
      expired.forEach(k => delete next[k]);
      return next;
    });

    addLog('End Turn — all cooldowns reduced by 1, +1 Sovereign Will');
    if (expired.length > 0) {
      setTimeout(() => {
        expired.forEach(k => notify(`Duration ended for ${k}`, 'info'));
      }, 0);
    }
    setTurn(prev => prev + 1);
    notify(`Turn ${turn} ended. Cooldowns reduced.`, 'success');
  };

  // ===== RESET BATTLE =====
  const handleResetBattle = () => {
    setCooldowns(() => {
      const cd = {};
      allSkills.forEach(s => { cd[s.name] = 0; });
      return cd;
    });
    setStatusCounters(() => {
      const sc = {};
      uniqueStatus.forEach(s => { sc[s.name] = 0; });
      return sc;
    });
    setActiveStatuses(() => {
      const as = {};
      uniqueStatus.forEach(s => { as[s.name] = false; });
      return as;
    });
    setCurrentHp(maxHp);
    setTurn(1);
    setLog([]);
    setActiveDurations({});
    notify('Battle reset!', 'info');
  };

  // ===== USE SKILL =====
  const handleUseSkill = (skill) => {
    const maxCd = parseCooldown(skill.cooldown);
    const cost = parseCost(skill.cost);
    const requiredStatus = parseRequiredStatus(skill.description);

    if (cooldowns[skill.name] > 0) {
      notify(`${skill.name} is on cooldown (${cooldowns[skill.name]} turns)`, 'error');
      return;
    }

    if (requiredStatus) {
      const statusActive = activeStatuses[requiredStatus];
      const statusCount = statusCounters[requiredStatus];
      if (!statusActive && (!statusCount || statusCount <= 0)) {
        notify(`Requires [${requiredStatus}] to use!`, 'error');
        return;
      }
    }

    if (cost) {
      const currentCount = statusCounters[cost.status] || 0;
      if (currentCount < cost.amount) {
        notify(`Not enough ${cost.status}! Need ${cost.amount}, have ${currentCount}`, 'error');
        return;
      }
      setStatusCounters(prev => ({
        ...prev,
        [cost.status]: prev[cost.status] - cost.amount
      }));
    }

    if (maxCd > 0) {
      setCooldowns(prev => ({ ...prev, [skill.name]: maxCd }));
    }

    if (skill.duration) {
      const parsedDuration = parseCooldown(skill.duration); // Extract digit
      if (parsedDuration > 0) {
        setActiveDurations(prev => ({ ...prev, [skill.name]: parsedDuration }));
      }
    }

    addLog(`Used "${skill.name}"${cost ? ` — spent ${cost.amount} ${cost.status}` : ''}`);
    notify(`Used ${skill.name}!`, 'success');
  };

  // ===== STATUS COUNTER CONTROLS =====
  const adjustStatus = (name, delta) => {
    setStatusCounters(prev => {
      const val = Math.max(0, (prev[name] || 0) + delta);
      return { ...prev, [name]: val };
    });
  };

  const toggleActive = (name) => {
    setActiveStatuses(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // ===== SOVEREIGN WILL QUICK ADD =====
  const handleSwQuickAdd = () => {
    const amount = parseInt(swQuickAdd) || 0;
    if (amount <= 0) return;
    setStatusCounters(prev => ({
      ...prev,
      'Sovereign Will': Math.min((prev['Sovereign Will'] || 0) + amount, 30)
    }));
    addLog(`Added ${amount} Sovereign Will`);
    notify(`+${amount} Sovereign Will`, 'success');
  };

  // ===== Check if skill can be used =====
  const canUseSkill = (skill) => {
    if (cooldowns[skill.name] > 0) return false;
    const cost = parseCost(skill.cost);
    if (cost && (statusCounters[cost.status] || 0) < cost.amount) return false;
    const req = parseRequiredStatus(skill.description);
    if (req && !activeStatuses[req] && !(statusCounters[req] > 0)) return false;
    return true;
  };

  // ===== HP percent =====
  const hpPercent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? 'var(--accent-green)' : hpPercent > 25 ? '#f59e0b' : 'var(--accent-red)';

  // ===== RENDER =====
  return (
    <div className="stack-lg">

      {/* ===== Turn Banner ===== */}
      <div className="turn-banner">
        <div>
          <div className="turn-label">Turn {turn}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Manage your actions below</div>
        </div>
        <div className="turn-actions">
          <button className="btn btn-reset-battle" onClick={handleResetBattle}>
            <RotateCcw size={14} /> Reset Battle
          </button>
          <button className="btn btn-end-turn" onClick={handleEndTurn}>
            <SkipForward size={16} /> End Turn
          </button>
        </div>
      </div>

      {/* ===== HP & Stats Bar ===== */}
      <div className="card" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* HP Tracker */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div className="stat-label" style={{ fontSize: '0.65rem' }}>
              <Heart size={12} style={{ color: hpColor }} /> HP
            </div>
            <div className="hp-tracker">
              <button className="counter-btn" onClick={() => setCurrentHp(prev => Math.max(0, prev - 1))}>−</button>
              <input
                type="number"
                className="hp-input"
                value={currentHp}
                onChange={(e) => setCurrentHp(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ color: hpColor }}
              />
              <span className="hp-separator">/</span>
              <span className="hp-max">{maxHp}</span>
              <button className="counter-btn" onClick={() => setCurrentHp(prev => Math.min(maxHp, prev + 1))}>+</button>
            </div>
            {/* HP Bar */}
            <div style={{
              width: '100%', height: 4, borderRadius: 2,
              background: 'var(--bg-tertiary)', overflow: 'hidden', minWidth: 120
            }}>
              <div style={{
                width: `${hpPercent}%`, height: '100%', borderRadius: 2,
                background: hpColor, transition: 'width 0.3s ease, background 0.3s ease'
              }} />
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1, justifyContent: 'center' }}>
            <div className="stat-badge" style={{ minWidth: 60 }}>
              <div className="stat-label">AC</div>
              <div className="stat-value ac">{stats.armorClass}</div>
            </div>
            <div className="stat-badge" style={{ minWidth: 60 }}>
              <div className="stat-label">STR</div>
              <div className="stat-value">{stats.strength}</div>
            </div>
            <div className="stat-badge" style={{ minWidth: 60 }}>
              <div className="stat-label">DEX</div>
              <div className="stat-value">{stats.dexterity}</div>
            </div>
            <div className="stat-badge" style={{ minWidth: 60 }}>
              <div className="stat-label">CON</div>
              <div className="stat-value">{stats.constitution}</div>
            </div>
            <div className="stat-badge" style={{ minWidth: 60 }}>
              <div className="stat-label">CHA</div>
              <div className="stat-value">{stats.charisma}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Status Counters ===== */}
      <div>
        <div className="section-header" style={{ marginBottom: '0.6rem' }}>
          <Zap size={18} className="section-header-icon" />
          <h2>Status Trackers</h2>
        </div>

        {/* Sovereign Will — Featured */}
        <div className="card card-gold" style={{
          padding: '0.8rem 1.2rem', marginBottom: '0.6rem',
          borderLeft: '3px solid var(--accent-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="font-display" style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1rem' }}>
              ✦ Sovereign Will
            </span>
            <div className="status-counter-controls">
              <button className="counter-btn" onClick={() => adjustStatus('Sovereign Will', -1)}>−</button>
              <span className="counter-value" style={{ fontSize: '1.3rem', fontWeight: 800, minWidth: 32, color: 'var(--accent-gold)' }}>
                {statusCounters['Sovereign Will'] || 0}
              </span>
              <button className="counter-btn" onClick={() => adjustStatus('Sovereign Will', 1)}>+</button>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ 30</span>
          </div>
          <div className="sw-quick-add">
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick:</span>
            <input
              type="number"
              className="sw-input"
              value={swQuickAdd}
              onChange={(e) => setSwQuickAdd(e.target.value)}
              min="1"
              max="30"
            />
            <button className="btn btn-sm btn-success" onClick={handleSwQuickAdd} style={{ padding: '0.25rem 0.6rem' }}>
              <Plus size={12} /> Add
            </button>
          </div>
          {/* SW Progress bar */}
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div style={{
              width: `${((statusCounters['Sovereign Will'] || 0) / 30) * 100}%`,
              height: '100%', borderRadius: 2,
              background: 'var(--accent-gold)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Other statuses */}
        <div className="status-counter-bar">
          {uniqueStatus.filter(s => s.name !== 'Sovereign Will').map((s, i) => (
            <div
              key={i}
              className="status-counter"
              style={{
                borderColor: activeStatuses[s.name] ? 'var(--accent-gold)' : undefined,
                background: activeStatuses[s.name] ? 'var(--accent-gold-bg)' : undefined,
              }}
            >
              <button
                onClick={() => toggleActive(s.name)}
                title={activeStatuses[s.name] ? 'Deactivate' : 'Activate'}
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid',
                  borderColor: activeStatuses[s.name] ? 'var(--accent-green)' : 'var(--border-color)',
                  background: activeStatuses[s.name] ? 'var(--accent-green)' : 'transparent',
                  cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease'
                }}
              />
              <span className="status-counter-name" title={s.name}>{s.name}</span>
              <div className="status-counter-controls">
                <button className="counter-btn" onClick={() => adjustStatus(s.name, -1)}>−</button>
                <span className="counter-value">{statusCounters[s.name] || 0}</span>
                <button className="counter-btn" onClick={() => adjustStatus(s.name, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Skills Grid ===== */}
      <div className="grid-2">
        <div className="stack-lg">

          {/* Character Skills */}
          <section>
            <div className="section-header">
              <Swords size={18} className="section-header-icon" />
              <h2>Character Skills</h2>
            </div>
            <div className="stack">
              {skills.map((s, i) => {
                const onCd = cooldowns[s.name] > 0;
                const usable = canUseSkill(s);
                const maxCd = parseCooldown(s.cooldown);
                return (
                  <div key={i} className={`skill-play-card ${onCd ? 'on-cooldown' : ''}`}>
                    <div className="skill-play-info">
                      <div className="skill-play-name">{s.name}</div>
                      <div className="skill-play-meta">
                        {s.level > 0 && <span className="badge badge-level">Lv {s.level}</span>}
                        {maxCd > 0 && (
                          onCd
                            ? <span className="badge badge-cd-active"><Clock size={10} /> {cooldowns[s.name]} turns</span>
                            : <span className="badge badge-ready">Ready</span>
                        )}
                        {activeDurations[s.name] > 0 && (
                          <span className="badge" style={{ background: 'var(--accent-green)', color: '#000' }}>
                            Active ({activeDurations[s.name]}T)
                          </span>
                        )}
                        {s.cost && <span className="badge badge-cost">{s.cost}</span>}
                        {s.type === 'Normal Attack' && <span className="badge badge-ready">Normal Attack</span>}
                      </div>
                      <div className="skill-play-desc">
                        <DescriptionList description={s.description} uniqueStatuses={uniqueStatus} />
                      </div>
                    </div>
                    <div className="skill-play-action">
                      <button
                        className="btn btn-use btn-sm"
                        disabled={!usable}
                        onClick={() => handleUseSkill(s)}
                      >
                        <Zap size={12} /> Use
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Passives (Reference) */}
          <section>
            <div className="section-header">
              <Shield size={18} className="section-header-icon" />
              <h2>Passives</h2>
            </div>
            <div className="stack">
              {passives.map((p, i) => (
                <div key={i} className="passive-card">
                  <div className="passive-name">{p.name}</div>
                  <DescriptionList description={p.description} uniqueStatuses={uniqueStatus} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="stack-lg">

          {/* Weapon Skills */}
          {weapons.map((w, wi) => (
            <section key={wi}>
              <div className="section-header">
                <Swords size={18} className="section-header-icon" />
                <h2>{w.name}</h2>
              </div>
              <div className="stack">
                {w.skills.map((ws, j) => {
                  const onCd = cooldowns[ws.name] > 0;
                  const usable = canUseSkill(ws);
                  const maxCd = parseCooldown(ws.cooldown);
                  return (
                    <div key={j} className={`skill-play-card ${onCd ? 'on-cooldown' : ''}`}>
                      <div className="skill-play-info">
                        <div className="skill-play-name" style={{ color: 'var(--accent-gold)' }}>{ws.name}</div>
                        <div className="skill-play-meta">
                          <span className="badge badge-weapon">Weapon</span>
                          {maxCd > 0 && (
                            onCd
                              ? <span className="badge badge-cd-active"><Clock size={10} /> {cooldowns[ws.name]} turns</span>
                              : <span className="badge badge-ready">Ready</span>
                          )}
                          {activeDurations[ws.name] > 0 && (
                            <span className="badge" style={{ background: 'var(--accent-green)', color: '#000' }}>
                              Active ({activeDurations[ws.name]}T)
                            </span>
                          )}
                        </div>
                        <div className="skill-play-desc">
                          <DescriptionList description={ws.description} uniqueStatuses={uniqueStatus} />
                        </div>
                      </div>
                      <div className="skill-play-action">
                        <button
                          className="btn btn-use btn-sm"
                          disabled={!usable}
                          onClick={() => handleUseSkill(ws)}
                        >
                          <Zap size={12} /> Use
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Runes */}
          <section>
            <div className="section-header">
              <Wind size={18} className="section-header-icon" />
              <h2>Runes</h2>
            </div>
            <div className="stack">
              {runes.map((r, i) => {
                const usable = canUseSkill(r);
                return (
                  <div key={i} className="skill-play-card">
                    <div className="skill-play-info">
                      <div className="skill-play-name" style={{ color: 'var(--accent-gold)' }}>{r.name}</div>
                      <div className="skill-play-meta">
                        {r.cost && <span className="badge badge-cost">{r.cost}</span>}
                        {activeDurations[r.name] > 0 ? (
                          <span className="badge" style={{ background: 'var(--accent-green)', color: '#000' }}>
                            Active ({activeDurations[r.name]}T left)
                          </span>
                        ) : (
                          r.duration && <span className="badge badge-cd">Duration: {r.duration}</span>
                        )}
                      </div>
                      <div className="skill-play-desc">
                        <DescriptionList description={r.description} uniqueStatuses={uniqueStatus} />
                      </div>
                    </div>
                    <div className="skill-play-action">
                      <button
                        className="btn btn-use btn-sm"
                        disabled={!usable}
                        onClick={() => handleUseSkill(r)}
                      >
                        <Zap size={12} /> Activate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Action Log */}
          <section>
            <div className="section-header">
              <Clock size={18} className="section-header-icon" />
              <h2>Action Log</h2>
            </div>
            <div className="card" style={{ padding: '0.8rem 1rem', maxHeight: 200, overflowY: 'auto' }}>
              {log.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No actions yet. Use a skill or end a turn to see the log.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {log.map((entry, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {entry}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ===== Notification Toast ===== */}
      <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <AnimatePresence>
          {notifications.map(n => (
            <Notification key={n.id} message={n.message} type={n.type} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PlaySheet;
