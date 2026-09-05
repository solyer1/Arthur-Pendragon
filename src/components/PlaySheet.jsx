import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DescriptionList from './DescriptionList';
import TooltipText from './TooltipText';
import {
  RotateCcw, Zap, Clock, SkipForward, Swords, Shield, Wind, Heart,
  Plus, Minus, Sparkles, Users, Crown, Flame, Award, ChevronDown, ChevronUp, User, Search
} from 'lucide-react';

/* ===== Storage Key for Combat State ===== */
const PLAY_STATE_KEY = 'arthurPlayState_v2';

function getSavedPlayState() {
  try {
    const saved = localStorage.getItem(PLAY_STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading arthurPlayState from localStorage:', e);
  }
  return null;
}

/* ===== Helper: parse cost string like "8 [Sovereign Will]" ===== */
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
  const allSkills = useMemo(() => {
    const arr = [];
    skills.forEach(s => arr.push({ ...s, source: 'skill' }));
    weapons.forEach(w => {
      w.skills.forEach(ws => arr.push({ ...ws, source: 'weapon', weaponName: w.name }));
    });
    runes.forEach(r => arr.push({ ...r, source: 'rune', cooldown: null }));
    return arr;
  }, [skills, weapons, runes]);

  // Load saved battle state if present
  const savedState = useMemo(() => getSavedPlayState(), []);

  // ===== GAME STATE (PERSISTED) =====
  const [turn, setTurn] = useState(() => savedState?.turn ?? 1);
  const [currentHp, setCurrentHp] = useState(() => savedState?.currentHp ?? stats.health);
  const [maxHp, setMaxHp] = useState(() => savedState?.maxHp ?? stats.health);
  const [cooldowns, setCooldowns] = useState(() => {
    const cd = {};
    allSkills.forEach(s => { cd[s.name] = savedState?.cooldowns?.[s.name] ?? 0; });
    return cd;
  });
  const [statusCounters, setStatusCounters] = useState(() => {
    const sc = {};
    uniqueStatus.forEach(s => { sc[s.name] = savedState?.statusCounters?.[s.name] ?? 0; });
    return sc;
  });
  const [activeStatuses, setActiveStatuses] = useState(() => {
    const as = {};
    uniqueStatus.forEach(s => {
      if (savedState?.activeStatuses?.[s.name] !== undefined) {
        as[s.name] = savedState.activeStatuses[s.name];
      } else {
        // Inherited Of The Wind's grants Compressed Winds when entering battle
        as[s.name] = s.name === 'Compressed Winds';
      }
    });
    // Ensure Compressed Winds is on by default if never explicitly toggled
    if (as['Compressed Winds'] === undefined) {
      as['Compressed Winds'] = true;
    }
    return as;
  });
  const [activeDurations, setActiveDurations] = useState(() => savedState?.activeDurations ?? {});
  const [log, setLog] = useState(() => savedState?.log ?? []);
  const [swQuickAdd, setSwQuickAdd] = useState(5);
  const [notifications, setNotifications] = useState([]);
  // Persistent collapse states
  const [showBuffIndicator, setShowBuffIndicator] = useState(() => {
    try {
      const saved = localStorage.getItem('arthur_buff_indicator_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [showConditions, setShowConditions] = useState(() => {
    try {
      const saved = localStorage.getItem('arthur_combat_conditions_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [showAllBuffs, setShowAllBuffs] = useState(() => {
    try {
      const saved = localStorage.getItem('arthur_buffs_dir_open');
      return saved !== null ? JSON.parse(saved) : false; // Default collapsed to keep battle screen clean
    } catch (e) {
      return false;
    }
  });
  const [buffViewMode, setBuffViewMode] = useState('detailed'); // 'detailed' | 'compact'
  const [buffSearch, setBuffSearch] = useState('');
  const [buffFilter, setBuffFilter] = useState('all');

  useEffect(() => {
    try {
      localStorage.setItem('arthur_buff_indicator_open', JSON.stringify(showBuffIndicator));
    } catch (e) {}
  }, [showBuffIndicator]);

  useEffect(() => {
    try {
      localStorage.setItem('arthur_combat_conditions_open', JSON.stringify(showConditions));
    } catch (e) {}
  }, [showConditions]);

  useEffect(() => {
    try {
      localStorage.setItem('arthur_buffs_dir_open', JSON.stringify(showAllBuffs));
    } catch (e) {}
  }, [showAllBuffs]);

  // Situational combat condition toggles (The Courage To Protect Others & Caliburn)
  const [combatConditions, setCombatConditions] = useState(() => savedState?.combatConditions ?? {
    alliesBelow50: 0,
    alliesBelow25: 0,
    hasDeadAlly: false,
    swordSelection: 'off', // 'off' | 'heads' | 1 | 2 | 3
    teamInspired: false,
  });

  const isResettingRef = useRef(false);

  // Automatically persist combat state across tab changes and page refreshes
  useEffect(() => {
    if (isResettingRef.current) return;
    try {
      const stateToSave = {
        turn,
        currentHp,
        maxHp,
        cooldowns,
        statusCounters,
        activeStatuses,
        activeDurations,
        combatConditions,
        log,
      };
      localStorage.setItem(PLAY_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save combat state to localStorage:', e);
    }
  }, [turn, currentHp, maxHp, cooldowns, statusCounters, activeStatuses, activeDurations, combatConditions, log]);

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

    addLog('End Turn — all cooldowns & active durations reduced by 1, +1 Sovereign Will');
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
    if (!window.confirm("Reset battle progress and reload the page? All combat state, cooldowns, and HP will be reset.")) return;

    isResettingRef.current = true;
    try {
      localStorage.removeItem(PLAY_STATE_KEY);
    } catch (e) {
      console.error('Error clearing combat state:', e);
    }

    window.location.reload();
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
      const parsedDuration = parseCooldown(skill.duration);
      if (parsedDuration > 0) {
        setActiveDurations(prev => ({ ...prev, [skill.name]: parsedDuration }));
      }
    }

    if (skill.name && (skill.name.includes("Curve of Blade") || skill.name.includes("Unleshed The Curve of Blade"))) {
      setActiveStatuses(prev => ({
        ...prev,
        'Compressed Winds': false,
        "Oaths of northwind's paladin : Arthur pendragon": true
      }));
      addLog("Replaced [Compressed Winds] with [Oaths of northwind's paladin : Arthur pendragon]");
    }

    addLog(`Used "${skill.name}"${cost ? ` — spent ${cost.amount} ${cost.status}` : ''}`);
    notify(`Used ${skill.name}!`, 'success');
  };

  // ===== STATUS COUNTER CONTROLS =====
  const adjustStatus = (name, delta) => {
    setStatusCounters(prev => {
      const maxVal = name === 'Sovereign Will' ? 30 : name === 'Slicing Gale' || name === 'Holy flame: Purgation' ? 10 : 99;
      const val = Math.max(0, Math.min(maxVal, (prev[name] || 0) + delta));
      return { ...prev, [name]: val };
    });
  };

  const toggleActive = (name) => {
    setActiveStatuses(prev => {
      const nextVal = !prev[name];
      const next = { ...prev, [name]: nextVal };

      const isOaths = name.toLowerCase().includes("oaths of northwind");
      const isCompressed = name.toLowerCase().includes("compressed winds");

      // Turning on Oath of Northwind turns off Compressed Winds
      if (isOaths && nextVal) {
        Object.keys(next).forEach(k => {
          if (k.toLowerCase().includes("compressed winds")) {
            next[k] = false;
          }
        });
      } else if (isCompressed && nextVal) {
        // Turning on Compressed Winds turns off Oath of Northwind
        Object.keys(next).forEach(k => {
          if (k.toLowerCase().includes("oaths of northwind")) {
            next[k] = false;
          }
        });
      }

      return next;
    });
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

  // ==========================================
  // ===== BUFF STATUS INDICATOR ENGINE =======
  // ==========================================

  // 1. Sovereign Will bonuses
  const swCount = statusCounters['Sovereign Will'] || 0;
  const swUni = Math.min(3, Math.floor(swCount / 5)); // +1 per 5, max +3
  const swDmg = Math.min(3, Math.floor(swCount / 10)); // +1 per 10, max +3
  const swRes = Math.min(30, Math.floor(swCount / 15) * 15); // +15% per 15, max 30%

  // 2. Active status effects
  const compWindsActive = Boolean(activeStatuses['Compressed Winds']);
  const compWindsUni = compWindsActive ? 2 : 0;

  const unyieldingActive = Boolean(activeStatuses['Unyielding Will']);
  const unyieldingUni = unyieldingActive ? 2 : 0;
  const unyieldingDmg = unyieldingActive ? 2 : 0;

  const oathsPaladinActive = Boolean(activeStatuses["Oaths of northwind's paladin : Arthur pendragon"]);

  // 3. Situational passives: The Courage To Protect Others
  const courageUni = Math.min(3, combatConditions.alliesBelow50 || 0);
  const courageDmg = Math.min(3, combatConditions.alliesBelow25 || 0);
  const deadAllyUni = combatConditions.hasDeadAlly ? 3 : 0;
  const deadAllyDmg = combatConditions.hasDeadAlly ? 3 : 0;

  // 4. Caliburn: Sword Of Selection
  let swordUni = 0;
  let swordDmgPct = 0;
  if (combatConditions.swordSelection === 'heads') {
    swordUni = 1;
    swordDmgPct = 5;
  } else if (typeof combatConditions.swordSelection === 'number' && combatConditions.swordSelection > 0) {
    swordUni = Math.min(3, combatConditions.swordSelection);
  }

  // 5. Active durations (Runes & Skills)
  const tiwazActive = (activeDurations['ᛏ - Tiwaz | Justice / Sacrifice'] || 0) > 0;
  const ansuzActive = (activeDurations['ᚨ - Ansuz | Divine Authority'] || 0) > 0;
  const sowiloActive = (activeDurations['ᛋ - Sowilo | Sun / Victory'] || 0) > 0;
  const othalaActive = (activeDurations['ᛟ - Othala | Heritage'] || 0) > 0;
  const roundsActive = (activeDurations['Rounds of Pendragon'] || 0) > 0;
  const radiantActive = (activeDurations['Radiant Sovereign'] || 0) > 0;
  const excaliburActive = (activeDurations["The False King's Miracle: Excalibur (Superimposition)"] || 0) > 0;

  // --- ARTHUR (MYSELF) TOTALS & BREAKDOWN ---
  const myUniTotal = swUni + compWindsUni + unyieldingUni + courageUni + deadAllyUni + swordUni;
  const myUniBreakdown = [];
  if (swUni > 0) myUniBreakdown.push(`+${swUni} Sovereign Will (${swCount})`);
  if (compWindsUni > 0) myUniBreakdown.push(`+${compWindsUni} Compressed Winds`);
  if (unyieldingUni > 0) myUniBreakdown.push(`+${unyieldingUni} Unyielding Will`);
  if (courageUni > 0) myUniBreakdown.push(`+${courageUni} Allies < 50% HP`);
  if (deadAllyUni > 0) myUniBreakdown.push(`+${deadAllyUni} Fallen Ally`);
  if (swordUni > 0) myUniBreakdown.push(`+${swordUni} Sword Of Selection`);

  // Destined King's passive grants Arthur +2 Dmg Rolls and +10% Damage
  const myDmgTotal = 2 + swDmg + courageDmg + deadAllyDmg + unyieldingDmg;
  const myDmgBreakdown = [`+2 Destined King's (DEX 20)`];
  if (swDmg > 0) myDmgBreakdown.push(`+${swDmg} Sovereign Will (${swCount})`);
  if (courageDmg > 0) myDmgBreakdown.push(`+${courageDmg} Allies < 25% HP`);
  if (deadAllyDmg > 0) myDmgBreakdown.push(`+${deadAllyDmg} Fallen Ally`);
  if (unyieldingDmg > 0) myDmgBreakdown.push(`+${unyieldingDmg} Unyielding Will`);

  const myDmgPctTotal = 10 + swordDmgPct;
  const myDmgPctBreakdown = [`+10% Destined King's`];
  if (swordDmgPct > 0) myDmgPctBreakdown.push(`+${swordDmgPct}% Caliburn Heads`);

  let myResTotal = swRes;
  const myResBreakdown = [];
  if (swRes > 0) myResBreakdown.push(`${swRes}% Sovereign Will`);
  if (tiwazActive) myResBreakdown.push(`50% Intercept (Tiwaz)`);
  if (radiantActive) myResBreakdown.push(`50% Dmg Reduc + 100% Shield (Radiant)`);

  // --- TEAM (พันธมิตร) TOTALS & BREAKDOWN ---
  const teamSowiloUni = sowiloActive ? 2 : 0;
  const teamRoundsUni = roundsActive ? 2 : 0;
  const teamExcaliburUni = excaliburActive ? 3 : 0;
  const teamUniTotal = teamSowiloUni + teamRoundsUni + teamExcaliburUni;
  const teamUniBreakdown = [];
  if (teamSowiloUni > 0) teamUniBreakdown.push(`+${teamSowiloUni} Sowilo Rune`);
  if (teamRoundsUni > 0) teamUniBreakdown.push(`+${teamRoundsUni} Rounds of Pendragon`);
  if (teamExcaliburUni > 0) teamUniBreakdown.push(`+${teamExcaliburUni} Excalibur Miracle`);

  const teamDmgTotal = 2; // From Destined King's (allies DEX <= 20 or highest DEX)
  const teamDmgPctTotal = 10 + (radiantActive ? 30 : 0);

  const isTeamInspired = combatConditions.teamInspired || unyieldingActive || turn === 1;

  // ==========================================
  // ===== ALL AVAILABLE BUFFS DIRECTORY ======
  // ==========================================
  const allAvailableBuffs = useMemo(() => {
    return [
      {
        id: 'destined_king_dmg',
        name: "Destined King's Influence",
        source: "Passive: The Influence Of Destined King's",
        category: 'damage',
        target: 'both',
        isActive: true,
        bonus: "+2 Damage Rolls & +10% Damage",
        desc: "Arthur and party members with DEX <= 20 (or highest DEX in party) gain +2 Damage Rolls and +10% Damage.",
        trigger: "Permanent Combat Aura"
      },
      {
        id: 'despair_resistance',
        name: "Despair Resistance",
        source: "Passive: The Influence Of Destined King's",
        category: 'utility',
        target: 'team',
        isActive: true,
        bonus: "Despair Immunity",
        desc: "All members of Arthur's party gain permanent resistance to the Despair status.",
        trigger: "Permanent Combat Aura"
      },
      {
        id: 'compressed_winds',
        name: "Compressed Winds",
        source: "Passive: Inherited Of The Wind's",
        category: 'roll',
        target: 'myself',
        isActive: compWindsActive,
        bonus: "+2 Universal Roll · Slicing Gale on Hit",
        desc: "Arthur gains +2 Universal Roll. Attacks inflict 1 [Slicing Gale]. Enemy Dodge and Parry checks suffer Disadvantage.",
        trigger: "Gained automatically when entering combat. Mutually exclusive with Oaths of Northwind.",
        toggleable: true,
        onToggle: () => toggleActive('Compressed Winds')
      },
      {
        id: 'oaths_northwind',
        name: "Oaths of Northwind's Paladin",
        source: "Unique Status: [Oaths of Northwind]",
        category: 'damage',
        target: 'myself',
        isActive: oathsPaladinActive,
        bonus: "30% True Dmg · 70% Holy Dmg · +40% Wind Dmg",
        desc: "Converts 30% of damage to True Damage and 70% to Holy Damage. If target has Slicing Gale, deals +40% bonus Wind Damage. +1 Resistance vs sinners/evil.",
        trigger: "Replaces Compressed Winds via Mana Disintegration or Stance Toggle.",
        toggleable: true,
        onToggle: () => toggleActive("Oaths of northwind's paladin : Arthur pendragon")
      },
      {
        id: 'sw_uni',
        name: "Sovereign Will: Universal Roll",
        source: "Unique Status: [Sovereign Will]",
        category: 'roll',
        target: 'myself',
        isActive: swUni > 0,
        bonus: `+${swUni} Universal Roll (Max +3)`,
        desc: "Every 5 Sovereign Will stacks grant +1 Universal Roll, up to a maximum of +3 at 15 stacks.",
        trigger: `Current SW: ${swCount}/30 (Unlocks at 5, 10, 15 SW).`
      },
      {
        id: 'sw_dmg',
        name: "Sovereign Will: Damage Roll",
        source: "Unique Status: [Sovereign Will]",
        category: 'roll',
        target: 'myself',
        isActive: swDmg > 0,
        bonus: `+${swDmg} Damage Roll (Max +3)`,
        desc: "Every 10 Sovereign Will stacks grant +1 Damage Roll, up to a maximum of +3 at 30 stacks.",
        trigger: `Current SW: ${swCount}/30 (Unlocks at 10, 20, 30 SW).`
      },
      {
        id: 'sw_res',
        name: "Sovereign Will: Damage Resistance",
        source: "Unique Status: [Sovereign Will]",
        category: 'defense',
        target: 'myself',
        isActive: swRes > 0,
        bonus: `${swRes}% Damage Resistance (Max 30%)`,
        desc: "Every 15 Sovereign Will stacks grant 15% Damage Resistance, up to 30% at 30 stacks.",
        trigger: `Current SW: ${swCount}/30 (Unlocks at 15, 30 SW).`
      },
      {
        id: 'courage_50',
        name: "Courage: Low HP Allies Protection",
        source: "Passive: The Courage To Protect Others",
        category: 'roll',
        target: 'myself',
        isActive: courageUni > 0,
        bonus: `+${courageUni} Universal Roll (Max +3)`,
        desc: "+1 Universal Roll for each ally whose HP is below 50%, up to +3.",
        trigger: "Active when party members fall below 50% HP."
      },
      {
        id: 'courage_25',
        name: "Courage: Critical HP Allies Protection",
        source: "Passive: The Courage To Protect Others",
        category: 'roll',
        target: 'myself',
        isActive: courageDmg > 0,
        bonus: `+${courageDmg} Damage Roll (Max +3)`,
        desc: "+1 Damage Roll for each ally whose HP is below 25%, up to +3.",
        trigger: "Active when party members fall below 25% HP."
      },
      {
        id: 'courage_dead',
        name: "Courage: Fallen Ally Vengeance",
        source: "Passive: The Courage To Protect Others",
        category: 'roll',
        target: 'myself',
        isActive: deadAllyUni > 0,
        bonus: "+3 Universal Rolls & +3 Damage Rolls",
        desc: "If at least one party member has died in combat, Arthur gains +3 Universal Rolls and +3 Damage Rolls.",
        trigger: "Active when 1 or more allies fall."
      },
      {
        id: 'courage_intercept',
        name: "Courage: Defend Ally Check",
        source: "Passive: The Courage To Protect Others",
        category: 'defense',
        target: 'myself',
        isActive: true,
        bonus: "+5 Defense Roll",
        desc: "Arthur can roll defense for an ally who failed their defense check (limit 1 ally / turn). The substitute defense roll gains +5.",
        trigger: "1 Ally per Turn when defending."
      },
      {
        id: 'sword_selection',
        name: "Sword Of Selection",
        source: "Weapon Passive: Caliburn",
        category: 'roll',
        target: 'myself',
        isActive: combatConditions.swordSelection !== 'off',
        bonus: combatConditions.swordSelection === 'heads' ? "+1 Uni Roll & +5% Damage" : typeof combatConditions.swordSelection === 'number' && combatConditions.swordSelection > 0 ? `+${combatConditions.swordSelection} Uni Roll` : "+1 Uni Roll (Heads or Kills)",
        desc: "Combat Phase Coin Flip: Heads grants +1 Universal Roll and +5% Damage. Tails grants +1 Universal Roll per enemy defeated (max 3).",
        trigger: "Combat Phase Coin Flip."
      },
      {
        id: 'inspired_buff',
        name: "[Inspired] Inspiration Aura",
        source: "Unique Status: [Inspired]",
        category: 'roll',
        target: 'both',
        isActive: isTeamInspired,
        bonus: "+4 Roll on Beneficial Actions · Synergy Advantage · Min Roll 10",
        desc: "Actions benefiting the ally gain +4 Universal Roll. Synergy actions gain Advantage, and universal rolls cannot fall below 10.",
        trigger: "Active on Turn 1, during Unyielding Will, or when Arthur rolls 17-20 in Oaths."
      },
      {
        id: 'unyielding_will',
        name: "[Unyielding Will] Immortal Stance",
        source: "Unique Status: [Unyielding Will]",
        category: 'defense',
        target: 'myself',
        isActive: unyieldingActive,
        bonus: "HP Cannot Fall < 1 · +2 Uni & Dmg · Advantage on All Actions",
        desc: "HP cannot drop below 1. All actions gain Advantage. Reduces skill cooldowns by 3 upon entry. Double Sovereign Will gain. Debuff immune.",
        trigger: "Triggered on Fatal Damage or manual activation.",
        toggleable: true,
        onToggle: () => toggleActive('Unyielding Will')
      },
      {
        id: 'tiwaz_rune',
        name: "ᛏ - Tiwaz | Justice / Sacrifice",
        source: "Rune Activation (5 Turns)",
        category: 'defense',
        target: 'myself',
        isActive: tiwazActive,
        bonus: "50% Intercept Dmg Reduction · +20% Dmg vs Evil",
        desc: "Arthur takes 50% less damage when taking hits for allies (gains 2 SW per intercept, up to 3/turn). Attacks deal +20% damage to Evil/Unholy and inflict Holy Flame.",
        trigger: "Cost 10 Sovereign Will. Duration: 5 Turns."
      },
      {
        id: 'ansuz_rune',
        name: "ᚨ - Ansuz | Divine Authority",
        source: "Rune Activation (4 Turns)",
        category: 'utility',
        target: 'team',
        isActive: ansuzActive,
        bonus: "Cooldown -1 at Turn End · Charm/Fear/Despair Immune · +3 to Aid",
        desc: "All party members have all skill cooldowns reduced by 1 at the end of each turn. Immune to Charm, Fear, and Despair. +3 Roll on actions aiding others.",
        trigger: "Cost 10 Sovereign Will. Duration: 4 Turns."
      },
      {
        id: 'algiz_rune',
        name: "ᛉ - Algiz | Protection",
        source: "Rune Activation",
        category: 'defense',
        target: 'both',
        isActive: false,
        bonus: "10% HP Ally Heal & 1-Hit Shield next turn",
        desc: "When Arthur protects or intercepts for an ally: gains 2 SW, heals ally for 10% Max HP, and Arthur receives an attack-blocking shield next turn.",
        trigger: "Cost 10 Sovereign Will."
      },
      {
        id: 'sowilo_rune',
        name: "ᛋ - Sowilo | Sun / Victory",
        source: "Rune Activation (3 Turns)",
        category: 'damage',
        target: 'both',
        isActive: sowiloActive,
        bonus: "Team +2 Uni Roll · +20% Holy Dmg · Heal 3% on Hit",
        desc: "Arthur and party gain +20% Holy Damage (+45% if Arthur is in Oaths). Allies gain +2 Universal Roll. Fear and Despair Immunity. Heal 3% Max HP on every hit.",
        trigger: "Cost 15 Sovereign Will. Duration: 3 Turns."
      },
      {
        id: 'othala_rune',
        name: "ᛟ - Othala | Heritage",
        source: "Rune Activation (3 Turns)",
        category: 'utility',
        target: 'team',
        isActive: othalaActive,
        bonus: "1 Ally Inherits All Arthur's Rolls, Dmg & Def",
        desc: "Choose 1 ally: they inherit all of Arthur's active Roll, Damage, and Damage Reduction buffs for 3 turns. If Arthur falls, transmits 1 rune to them.",
        trigger: "Cost 15 Sovereign Will. Duration: 3 Turns."
      },
      {
        id: 'radiant_sovereign',
        name: "Radiant Sovereign",
        source: "Weapon Skill: Caliburn (3 Turns)",
        category: 'damage',
        target: 'both',
        isActive: radiantActive,
        bonus: "Team +30% Damage · Arthur 100% HP Shield & 50% Dmg Reduction",
        desc: "Plant sword in ground: boosts team damage by +30%. Deals 1d10 AOE per turn to enemies. Arthur gains a 100% Max HP shield and takes 50% less damage.",
        trigger: "Cooldown: 5 turns. Duration: 3 turns."
      },
      {
        id: 'rounds_of_pendragon',
        name: "Rounds of Pendragon",
        source: "Character Skill (Lv 17, 5 Turns)",
        category: 'utility',
        target: 'both',
        isActive: roundsActive,
        bonus: "3 Allies Extra Action 1/turn & +2 Uni Roll · Arthur Follow-Up 2d8/3d8",
        desc: "Appoint 3 allies: they gain 1 Extra Action per turn and +2 Universal Roll. Every time an appointed ally hits, Arthur delivers a free 2d8 Follow-Up attack (no check needed).",
        trigger: "Cooldown: 8 turns. Duration: 5 turns."
      },
      {
        id: 'excalibur_miracle',
        name: "The False King's Miracle: Excalibur",
        source: "Ultimate Skill (Lv 18, 3 Turns)",
        category: 'utility',
        target: 'team',
        isActive: excaliburActive,
        bonus: "Allies Heal 50% Max HP & +3 Universal Roll",
        desc: "Allies are healed for 50% of their Max HP and gain +3 Universal Roll for 3 turns. Enemies suffer 12d12x2 AOE damage, 10 Slicing Gale, 10 Holy Flame, and 2-turn Despair.",
        trigger: "Cost 30 Sovereign Will. Duration: 3 turns."
      },
      {
        id: 'holy_flame_regen',
        name: "Holy Flame: Purgation Regeneration",
        source: "Unique Status: [Holy flame: Purgation]",
        category: 'healing',
        target: 'team',
        isActive: (statusCounters['Holy flame: Purgation'] || 0) > 0,
        bonus: `Regenerate ${Math.min(50, (statusCounters['Holy flame: Purgation'] || 0) * 5)}% Max HP / Turn`,
        desc: "Non-evil allies with this status heal 5% of their Max HP per stack at the end of each turn. Spend 3 stacks to cleanse 1 debuff. Burn damage is converted to Holy Flame.",
        trigger: `Current Stacks: ${statusCounters['Holy flame: Purgation'] || 0} / 10.`
      },
      {
        id: 'le_morte_arthur',
        name: "Le Morte d'Arthur (Fatal Guardian)",
        source: "Passive: Le Morte d'Arthur",
        category: 'defense',
        target: 'both',
        isActive: true,
        bonus: "Fatal Dmg Immunity & 50% Ally Heal (or HP Swap + 20% Heal + +3 Uni)",
        desc: "Once per combat: when an ally would suffer fatal damage, Arthur gains immunity and intercepts it, healing the ally for 50% Max HP. Alternatively, swap HP with ally, heal 20%, and grant +3 Uni Roll.",
        trigger: "Once per Combat."
      },
      {
        id: 'inherited_wind_speed',
        name: "Inherited Of The Wind's: Mach 2 Speed",
        source: "Passive: Inherited Of The Wind's",
        category: 'utility',
        target: 'myself',
        isActive: true,
        bonus: "Advantage on Movement/Escape/Pursuit · Mach 2 Speed",
        desc: "Arthur moves at up to 2,470 km/h (Mach 2). Gains Advantage on Fleeing, Pursuit, and Exploration. Enemies cannot pursue unless as fast as Arthur.",
        trigger: "Permanent Passive."
      }
    ];
  }, [
    compWindsActive, oathsPaladinActive, unyieldingActive, tiwazActive, ansuzActive,
    sowiloActive, othalaActive, roundsActive, radiantActive, excaliburActive,
    swUni, swDmg, swRes, swCount, courageUni, courageDmg, deadAllyUni,
    combatConditions, isTeamInspired, statusCounters
  ]);

  const activeBuffsCount = useMemo(() => {
    return allAvailableBuffs.filter(b => b.isActive).length;
  }, [allAvailableBuffs]);

  const filteredBuffs = useMemo(() => {
    return allAvailableBuffs.filter(b => {
      if (buffFilter === 'active' && !b.isActive) return false;
      if (buffFilter === 'myself' && b.target !== 'myself' && b.target !== 'both') return false;
      if (buffFilter === 'team' && b.target !== 'team' && b.target !== 'both') return false;
      if (buffFilter === 'roll' && b.category !== 'roll') return false;
      if (buffFilter === 'damage' && b.category !== 'damage') return false;
      if (buffFilter === 'defense' && b.category !== 'defense') return false;
      if (buffFilter === 'utility' && b.category !== 'utility' && b.category !== 'immunity' && b.category !== 'healing') return false;

      if (buffSearch.trim()) {
        const q = buffSearch.toLowerCase();
        return b.name.toLowerCase().includes(q) ||
               b.source.toLowerCase().includes(q) ||
               b.bonus.toLowerCase().includes(q) ||
               b.desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allAvailableBuffs, buffFilter, buffSearch]);

  // ===== RENDER =====
  return (
    <div className="stack-lg">

      {/* ===== Turn Banner ===== */}
      <div className="turn-banner">
        <div>
          <div className="turn-label">Turn {turn}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Battle progress automatically saved</div>
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

      {/* ======================================================= */}
      {/* ===== BUFF STATUS INDICATOR (MYSELF & TEAM) =========== */}
      {/* ======================================================= */}
      <div className={`buff-indicator-container ${!showBuffIndicator ? 'is-collapsed' : ''}`}>
        <div
          className="buff-indicator-header"
          onClick={() => setShowBuffIndicator(prev => !prev)}
          role="button"
          tabIndex={0}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-gold)' }} />
            <h2 className="font-display" style={{ fontSize: '1.15rem', color: 'var(--accent-gold)', margin: 0 }}>
              Buff & Roll Status Indicators
            </h2>
            <span className="buff-status-pill active" style={{ fontSize: '0.65rem' }}>
              Arthur: +{myUniTotal} Uni / +{myDmgTotal} Dmg
            </span>
            <span className="buff-status-pill standby" style={{ fontSize: '0.65rem' }}>
              Team: +{teamUniTotal} Uni / +{teamDmgTotal} Dmg
            </span>
            <span className="buff-status-pill active" style={{ fontSize: '0.65rem' }}>
              {activeBuffsCount} Active
            </span>
          </div>

          <div
            style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            {showBuffIndicator && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowConditions(prev => !prev)}
                  style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {showConditions ? <><ChevronUp size={14} /> Hide Conditions</> : <><ChevronDown size={14} /> Tactical Conditions</>}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAllBuffs(prev => !prev)}
                  style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {showAllBuffs ? <><ChevronUp size={14} /> Hide Directory</> : <><ChevronDown size={14} /> All Buffs ({allAvailableBuffs.length})</>}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowBuffIndicator(prev => !prev)}
              style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-gold)' }}
            >
              {showBuffIndicator ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Expand</>}
            </button>
          </div>
        </div>

        {showBuffIndicator && (
          <>
            <div className="buff-indicator-grid">

          {/* ===== COLUMN 1: MYSELF (ARTHUR) ===== */}
          <div className="buff-column buff-col-myself">
            <div className="buff-col-header">
              <div className="buff-col-title" style={{ color: 'var(--accent-gold)' }}>
                <Crown size={16} /> Myself (Arthur)
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paladin · DEX {stats.dexterity}</span>
            </div>

            {/* Stat Badges */}
            <div className="buff-stats-row">
              <div className="buff-stat-card">
                <div className="buff-stat-val uni">+{myUniTotal}</div>
                <div className="buff-stat-label">Uni Roll</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val dmg">+{myDmgTotal}</div>
                <div className="buff-stat-label">Atk / Dmg Roll</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val pct">+{myDmgPctTotal}%</div>
                <div className="buff-stat-label">Dmg Multiplier</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val res">{myResTotal > 0 ? `${myResTotal}%` : '0%'}</div>
                <div className="buff-stat-label">Dmg Resistance</div>
              </div>
            </div>

            {/* Active Breakdown Chips */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Active Breakdown:
              </div>
              <div className="buff-breakdown-list">
                {myUniBreakdown.map((b, bi) => (
                  <span key={bi} className="buff-chip highlight-blue">{b}</span>
                ))}
                {myDmgBreakdown.map((b, bi) => (
                  <span key={bi} className="buff-chip highlight-gold">{b}</span>
                ))}
                {myDmgPctBreakdown.map((b, bi) => (
                  <span key={bi} className="buff-chip">{b}</span>
                ))}
                {myResBreakdown.map((b, bi) => (
                  <span key={bi} className="buff-chip" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>{b}</span>
                ))}
                {myUniBreakdown.length === 0 && myDmgBreakdown.length <= 1 && (
                  <span className="buff-chip" style={{ fontStyle: 'italic', opacity: 0.7 }}>Base Destined King passive only</span>
                )}
              </div>
            </div>

            {/* Quick Stance Toggles for Arthur */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              <button
                className={`condition-pill-btn ${compWindsActive ? 'active' : ''}`}
                onClick={() => toggleActive('Compressed Winds')}
                title="Passive: Inherited Of The Wind's (+2 Uni Roll, Enemy Disadvantage on Dodge/Parry, Inflicts Slicing Gale)"
              >
                <Wind size={12} style={{ display: 'inline', marginRight: 4 }} />
                [Compressed Winds] {compWindsActive ? 'ON (+2 Uni)' : 'OFF'}
              </button>
              <button
                className={`condition-pill-btn ${oathsPaladinActive ? 'active' : ''}`}
                onClick={() => toggleActive("Oaths of northwind's paladin : Arthur pendragon")}
                title="30% True Dmg, 70% Holy Dmg, +40% Wind Dmg on Slicing Gale"
              >
                <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                [Oaths of Northwind] {oathsPaladinActive ? 'ON' : 'OFF'}
              </button>
              <button
                className={`condition-pill-btn ${unyieldingActive ? 'active' : ''}`}
                onClick={() => toggleActive('Unyielding Will')}
                style={unyieldingActive ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: '#fff' } : {}}
                title="HP >= 1, All Actions Advantage, +2 Uni, +2 Dmg"
              >
                <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
                [Unyielding Will] {unyieldingActive ? 'ON (+2 Uni/Dmg)' : 'OFF'}
              </button>
            </div>

            {/* Arthur Stances / Special State Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem' }}>
              {unyieldingActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-bg)', color: 'var(--accent-red-light)' }}>
                  <Zap size={13} /> <strong>[Unyielding Will]</strong> HP ≥ 1 · All Actions Advantage · 2x Sovereign Will
                </div>
              )}
              {compWindsActive && (
                <div className="buff-aura-pill active">
                  <Wind size={13} /> <strong>[Compressed Winds]</strong> +2 Uni Roll · Enemy Dodge/Parry Disadvantage · Slicing Gale on hit
                </div>
              )}
              {oathsPaladinActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-blue-light)' }}>
                  <Sparkles size={13} /> <strong>[Oaths of Northwind]</strong> 30% True Dmg · 70% Holy Dmg · +40% Wind Dmg on Slicing Gale
                </div>
              )}
              {tiwazActive && (
                <div className="buff-aura-pill active">
                  <Shield size={13} /> <strong>[Tiwaz Active]</strong> 50% Less Dmg on Intercept · +20% vs Evil/Unholy
                </div>
              )}
              {radiantActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-gold)' }}>
                  <Crown size={13} /> <strong>[Radiant Sovereign]</strong> 100% Max HP Shield · 50% Dmg Reduction
                </div>
              )}
              {sowiloActive && (
                <div className="buff-aura-pill active">
                  <Flame size={13} /> <strong>[Sowilo Active]</strong> +20% Holy Damage (+45% if Oaths active) · Heal 3% on hit
                </div>
              )}
            </div>
          </div>

          {/* ===== COLUMN 2: TEAM / ALLIES ===== */}
          <div className="buff-column buff-col-team">
            <div className="buff-col-header">
              <div className="buff-col-title" style={{ color: 'var(--accent-blue-light)' }}>
                <Users size={16} /> Team & Allies
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Party Auric & Synergy Buffs</span>
            </div>

            {/* Stat Badges for Team */}
            <div className="buff-stats-row">
              <div className="buff-stat-card">
                <div className="buff-stat-val uni">+{teamUniTotal}</div>
                <div className="buff-stat-label">Uni Roll Granted</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val dmg">+{teamDmgTotal}</div>
                <div className="buff-stat-label">Atk / Dmg Roll</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val pct">+{teamDmgPctTotal}%</div>
                <div className="buff-stat-label">Team Dmg Multiplier</div>
              </div>
              <div className="buff-stat-card">
                <div className="buff-stat-val res">
                  {statusCounters['Holy flame: Purgation'] > 0 ? `${Math.min(50, statusCounters['Holy flame: Purgation'] * 5)}%` : '0%'}
                </div>
                <div className="buff-stat-label">Team HP Regen / Turn</div>
              </div>
            </div>

            {/* Active Team Auras List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Auras & Passive Protection:
              </div>

              <div className="buff-aura-pill">
                <Shield size={13} style={{ color: 'var(--accent-green)' }} />
                <span><strong>Ally Intercept</strong>: Arthur takes hit with +5 Defense roll (1/turn)</span>
              </div>

              <div className="buff-aura-pill">
                <Shield size={13} style={{ color: 'var(--accent-green)' }} />
                <span><strong>Despair Resistance</strong> (Always active from Destined King)</span>
              </div>

              {isTeamInspired && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-gold)' }}>
                  <Sparkles size={13} style={{ color: 'var(--accent-gold)' }} />
                  <span><strong>[Inspired Active]</strong> +4 Roll on Beneficial Action · Synergy Advantage · Min Roll 10</span>
                </div>
              )}

              {ansuzActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-blue-light)' }}>
                  <Wind size={13} />
                  <span><strong>[Ansuz Active]</strong> Skill Cooldown -1 at Turn End · Charm/Fear/Despair Immune · +3 to Aid Others</span>
                </div>
              )}

              {sowiloActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-gold)' }}>
                  <Flame size={13} />
                  <span><strong>[Sowilo Active]</strong> +2 Uni Roll · Fear/Despair Immune · Heal 3% Max HP on hit</span>
                </div>
              )}

              {roundsActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-gold)' }}>
                  <Swords size={13} />
                  <span><strong>[Rounds of Pendragon]</strong> 3 Allies get Extra Action 1/turn · Arthur Follow-up Attacks</span>
                </div>
              )}

              {excaliburActive && (
                <div className="buff-aura-pill active" style={{ borderColor: 'var(--accent-gold)', background: 'var(--accent-gold-bg)' }}>
                  <Sparkles size={13} />
                  <span><strong>[Excalibur Active]</strong> +3 Universal Roll · Healed 50% Max HP ({activeDurations["The False King's Miracle: Excalibur (Superimposition)"]}T left)</span>
                </div>
              )}

              {othalaActive && (
                <div className="buff-aura-pill active">
                  <Award size={13} />
                  <span><strong>[Othala Active]</strong> 1 chosen ally inherits Arthur's rolls, damage & defense buffs!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== TACTICAL COMBAT CONDITIONS (QUICK TOGGLES) ===== */}
        {showConditions && (
          <div className="tactical-conditions-panel">
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Zap size={14} /> Tactical Combat Conditions (The Courage To Protect Others & Caliburn)
            </div>

            <div className="condition-toggle-row">
              <span className="condition-toggle-label">Allies &lt; 50% HP (+1 Uni each):</span>
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`condition-pill-btn ${combatConditions.alliesBelow50 === n ? 'active' : ''}`}
                  onClick={() => setCombatConditions(prev => ({ ...prev, alliesBelow50: n }))}
                >
                  {n === 0 ? 'None (0)' : `+${n} (${n} Allies)`}
                </button>
              ))}
            </div>

            <div className="condition-toggle-row">
              <span className="condition-toggle-label">Allies &lt; 25% HP (+1 Dmg each):</span>
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`condition-pill-btn ${combatConditions.alliesBelow25 === n ? 'active' : ''}`}
                  onClick={() => setCombatConditions(prev => ({ ...prev, alliesBelow25: n }))}
                >
                  {n === 0 ? 'None (0)' : `+${n} (${n} Allies)`}
                </button>
              ))}
            </div>

            <div className="condition-toggle-row">
              <span className="condition-toggle-label">Fallen Ally (+3 Uni, +3 Dmg):</span>
              <button
                className={`condition-pill-btn ${!combatConditions.hasDeadAlly ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, hasDeadAlly: false }))}
              >
                All Alive
              </button>
              <button
                className={`condition-pill-btn ${combatConditions.hasDeadAlly ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, hasDeadAlly: true }))}
              >
                1+ Fallen (+3 Uni, +3 Dmg)
              </button>
            </div>

            <div className="condition-toggle-row">
              <span className="condition-toggle-label">Caliburn: Sword Of Selection:</span>
              <button
                className={`condition-pill-btn ${combatConditions.swordSelection === 'off' ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, swordSelection: 'off' }))}
              >
                Off
              </button>
              <button
                className={`condition-pill-btn ${combatConditions.swordSelection === 'heads' ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, swordSelection: 'heads' }))}
              >
                Heads (+1 Uni, +5% Dmg)
              </button>
              {[1, 2, 3].map(kills => (
                <button
                  key={kills}
                  className={`condition-pill-btn ${combatConditions.swordSelection === kills ? 'active' : ''}`}
                  onClick={() => setCombatConditions(prev => ({ ...prev, swordSelection: kills }))}
                >
                  Tails: {kills} Kill{kills > 1 ? 's' : ''} (+{kills} Uni)
                </button>
              ))}
            </div>

            <div className="condition-toggle-row">
              <span className="condition-toggle-label">Team [Inspired] Status:</span>
              <button
                className={`condition-pill-btn ${!combatConditions.teamInspired ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, teamInspired: false }))}
              >
                Normal
              </button>
              <button
                className={`condition-pill-btn ${combatConditions.teamInspired ? 'active' : ''}`}
                onClick={() => setCombatConditions(prev => ({ ...prev, teamInspired: true }))}
              >
                Active (+4 Benevolent Roll)
              </button>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* ===== ALL AVAILABLE BUFFS DIRECTORY (FULL ROSTER) ===== */}
        {/* ======================================================= */}
        <div className="all-buffs-accordion">
          <div
            className="all-buffs-accordion-header"
            onClick={() => setShowAllBuffs(prev => !prev)}
            role="button"
            tabIndex={0}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Sparkles size={15} style={{ color: 'var(--accent-gold)' }} />
              <h3 className="font-display" style={{ fontSize: '0.95rem', color: 'var(--accent-gold)', margin: 0 }}>
                All Available Buffs Directory
              </h3>
              <span className="buff-status-pill active" style={{ fontSize: '0.62rem' }}>
                {activeBuffsCount} Active Now
              </span>
              <span className="buff-status-pill standby" style={{ fontSize: '0.62rem' }}>
                {allAvailableBuffs.length - activeBuffsCount} Standby
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ({allAvailableBuffs.length} Total in Kit)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)' }}>
                {showAllBuffs ? '▲ Click to Collapse' : '▼ Click to Expand'}
              </span>
              <div style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }}>
                {showAllBuffs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>

          {!showAllBuffs && (
            <div
              className="all-buffs-collapsed-preview"
              onClick={() => setShowAllBuffs(true)}
              title="Click to expand directory"
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Currently Active:</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                {allAvailableBuffs.filter(b => b.isActive).map(b => (
                  <span key={b.id} className="buff-chip active" style={{ fontSize: '0.68rem' }}>
                    ✦ {b.name}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', whiteSpace: 'nowrap' }}>
                Expand All {allAvailableBuffs.length} Buffs ▾
              </span>
            </div>
          )}

          {showAllBuffs && (
            <div className="all-buffs-roster-body">
              {/* Controls: Search, Category Filters, View Mode */}
              <div className="all-buffs-controls">
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: 1 }}>
                  {[
                    { id: 'all', label: `All (${allAvailableBuffs.length})` },
                    { id: 'active', label: `Active (${activeBuffsCount})` },
                    { id: 'myself', label: 'Arthur' },
                    { id: 'team', label: 'Team' },
                    { id: 'roll', label: 'Rolls' },
                    { id: 'damage', label: 'Damage' },
                    { id: 'defense', label: 'Defense' },
                    { id: 'utility', label: 'Auras & Utility' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      className={`condition-pill-btn ${buffFilter === tab.id ? 'active' : ''}`}
                      onClick={() => setBuffFilter(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div className="view-mode-toggle" style={{ display: 'flex', gap: '0.2rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${buffViewMode === 'detailed' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setBuffViewMode('detailed')}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${buffViewMode === 'compact' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setBuffViewMode('compact')}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                    >
                      Compact
                    </button>
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="buff-search-input"
                      style={{ paddingLeft: '1.8rem' }}
                      placeholder="Search buff name or effect..."
                      value={buffSearch}
                      onChange={(e) => setBuffSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Grid or Compact List */}
              {buffViewMode === 'detailed' ? (
                <div className="all-buffs-grid">
                  {filteredBuffs.map(buff => (
                    <div key={buff.id} className={`buff-roster-card ${buff.isActive ? 'is-active' : ''}`}>
                      <div className="buff-roster-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className={`buff-status-pill ${buff.isActive ? 'active' : 'standby'}`}>
                            {buff.isActive ? 'Active' : 'Standby'}
                          </span>
                          <span className="buff-chip" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                            {buff.target === 'myself' ? '👤 Arthur' : buff.target === 'team' ? '👥 Team' : '🌐 Both'}
                          </span>
                        </div>
                        <span className="buff-chip" style={{ fontSize: '0.62rem', textTransform: 'capitalize' }}>
                          {buff.category}
                        </span>
                      </div>

                      <div className="buff-roster-name">{buff.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {buff.source}
                      </div>

                      <div className="buff-roster-bonus">{buff.bonus}</div>
                      <div className="buff-roster-desc">{buff.desc}</div>
                      <div className="buff-roster-trigger">
                        <strong>Trigger:</strong> {buff.trigger}
                      </div>

                      {buff.toggleable && (
                        <div style={{ marginTop: '0.3rem' }}>
                          <button
                            className={`condition-pill-btn ${buff.isActive ? 'active' : ''}`}
                            onClick={buff.onToggle}
                            style={{ width: '100%', textAlign: 'center', padding: '0.3rem' }}
                          >
                            {buff.isActive ? '✓ Stance Active (Click to Turn OFF)' : '✦ Turn ON Stance'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredBuffs.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No buffs found matching "{buffSearch}".
                    </div>
                  )}
                </div>
              ) : (
                <div className="all-buffs-compact-list">
                  {filteredBuffs.map(buff => (
                    <div key={buff.id} className={`buff-compact-row ${buff.isActive ? 'is-active' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 200, flex: 1 }}>
                        <span className={`buff-status-pill ${buff.isActive ? 'active' : 'standby'}`}>
                          {buff.isActive ? 'Active' : 'Standby'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="buff-compact-name">{buff.name}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{buff.source}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span className="buff-chip" style={{ fontSize: '0.62rem' }}>
                          {buff.target === 'myself' ? '👤 Arthur' : buff.target === 'team' ? '👥 Team' : '🌐 Both'}
                        </span>
                        <span className="buff-chip" style={{ fontSize: '0.62rem', textTransform: 'capitalize' }}>
                          {buff.category}
                        </span>
                      </div>

                      <div className="buff-compact-bonus" style={{ flex: 1.2, minWidth: 180 }}>
                        {buff.bonus}
                      </div>

                      {buff.toggleable ? (
                        <button
                          className={`condition-pill-btn ${buff.isActive ? 'active' : ''}`}
                          onClick={buff.onToggle}
                          style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
                        >
                          {buff.isActive ? 'Active (OFF)' : 'Turn ON'}
                        </button>
                      ) : (
                        <div style={{ width: 80, textAlign: 'right', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {buff.isActive ? '✓ In Effect' : 'Standby'}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredBuffs.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No buffs found matching "{buffSearch}".
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Collapse Button */}
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAllBuffs(false)}
                  style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-gold)' }}
                >
                  <ChevronUp size={14} /> Collapse Buffs Directory
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}
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
                            Active ({activeDurations[s.name]}T left)
                          </span>
                        )}
                        {s.duration && !activeDurations[s.name] && (
                          <span className="badge badge-cd">Duration: {s.duration}</span>
                        )}
                        {s.cost && <span className="badge badge-cost">{s.cost}</span>}
                        {s.type === 'Normal Attack' && <span className="badge badge-ready">Normal Attack</span>}
                        {s.type === 'Ultimate' && <span className="badge badge-level" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>Ultimate</span>}
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

          {/* Weapon Skills & Passives */}
          {weapons.map((w, wi) => (
            <section key={wi}>
              <div className="section-header">
                <Swords size={18} className="section-header-icon" />
                <h2>{w.name}</h2>
              </div>

              {/* Weapon Passives if any (e.g. Sword Of Selection) */}
              {w.passives && w.passives.length > 0 && (
                <div style={{ marginBottom: '0.8rem' }}>
                  {w.passives.map((wp, pi) => (
                    <div key={pi} className="passive-card" style={{ borderLeft: '3px solid var(--accent-gold)', marginBottom: '0.5rem' }}>
                      <div className="passive-name" style={{ color: 'var(--accent-gold)' }}>✦ {wp.name}</div>
                      <DescriptionList description={wp.description} uniqueStatuses={uniqueStatus} />
                    </div>
                  ))}
                </div>
              )}

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
                              Active ({activeDurations[ws.name]}T left)
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
