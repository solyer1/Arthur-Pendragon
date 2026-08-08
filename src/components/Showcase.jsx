import React from 'react';
import DescriptionList from './DescriptionList';
import TooltipText from './TooltipText';
import { Sparkles, Sword, Shield, Wind, Crown } from 'lucide-react';

const Showcase = ({ data }) => {
  const { stats, passives, uniqueStatus, skills, weapons, runes } = data;

  return (
    <div className="stack-lg">

      {/* ===== Character Header ===== */}
      <div className="card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.2rem' }}>
          <img src="/logo.png" alt="Arthur Pendragon" className="header-logo" style={{ width: 64, height: 64 }} onError={(e) => e.target.style.display = 'none'} />
          <div>
            <h1 className="font-display" style={{ fontSize: '1.8rem', color: 'var(--accent-gold)' }}>Arthur Pendragon</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {stats.class} · {stats.alignment}
            </div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-badge"><div className="stat-label">HP</div><div className="stat-value hp">{stats.health}</div></div>
          <div className="stat-badge"><div className="stat-label">AC</div><div className="stat-value ac">{stats.armorClass}</div></div>
          <div className="stat-badge"><div className="stat-label">STR</div><div className="stat-value">{stats.strength}</div></div>
          <div className="stat-badge"><div className="stat-label">DEX</div><div className="stat-value">{stats.dexterity}</div></div>
          <div className="stat-badge"><div className="stat-label">CON</div><div className="stat-value">{stats.constitution}</div></div>
          <div className="stat-badge"><div className="stat-label">INT</div><div className="stat-value">{stats.intelligence}</div></div>
          <div className="stat-badge"><div className="stat-label">WIS</div><div className="stat-value">{stats.wisdom}</div></div>
          <div className="stat-badge"><div className="stat-label">CHA</div><div className="stat-value">{stats.charisma}</div></div>
        </div>
      </div>

      {/* ===== Passives ===== */}
      <section>
        <div className="section-header">
          <Sparkles size={18} className="section-header-icon" />
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

      {/* ===== Unique Statuses ===== */}
      <section>
        <div className="section-header">
          <Crown size={18} className="section-header-icon" />
          <h2>Unique Statuses</h2>
        </div>
        <div className="stack">
          {uniqueStatus.map((s, i) => (
            <div key={i} className="card card-gold" style={{ padding: '1rem 1.2rem', borderLeft: '3px solid var(--accent-gold)' }}>
              <div className="font-display" style={{ fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                ✦ {s.name}
              </div>
              <DescriptionList description={s.description} uniqueStatuses={uniqueStatus} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2">
        {/* ===== LEFT: Skills ===== */}
        <div className="stack-lg">
          <section>
            <div className="section-header">
              <Sword size={18} className="section-header-icon" />
              <h2>Skills</h2>
            </div>
            <div className="stack">
              {skills.map((s, i) => (
                <div key={i} className="card" style={{ padding: '1rem 1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.name}</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {s.level > 0 && <span className="badge badge-level">Lv {s.level}</span>}
                      {s.cooldown && <span className="badge badge-cd">{s.cooldown}</span>}
                      {s.cost && <span className="badge badge-cost">{s.cost}</span>}
                    </div>
                  </div>
                  <DescriptionList description={s.description} uniqueStatuses={uniqueStatus} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ===== RIGHT: Weapon + Runes ===== */}
        <div className="stack-lg">
          {/* Weapon */}
          {weapons.map((w, i) => (
            <section key={i}>
              <div className="section-header">
                <Shield size={18} className="section-header-icon" />
                <h2>Weapon</h2>
              </div>
              <div className="weapon-card">
                <div className="weapon-header">
                  <div className="weapon-name">{w.name}</div>
                  <div className="weapon-type">{w.type}</div>
                </div>
                <div className="weapon-body">
                  <div className="weapon-lore">
                    {typeof w.description === 'string'
                      ? <TooltipText text={w.description} uniqueStatuses={uniqueStatus} />
                      : <DescriptionList description={w.description} uniqueStatuses={uniqueStatus} />
                    }
                  </div>
                  <div className="stack">
                    {w.skills.map((ws, j) => (
                      <div key={j} className="card" style={{ padding: '0.8rem 1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{ws.name}</span>
                          <span className="badge badge-cd">CD: {ws.cooldown}</span>
                        </div>
                        <DescriptionList description={ws.description} uniqueStatuses={uniqueStatus} />
                      </div>
                    ))}
                  </div>
                </div>
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
              {runes.map((r, i) => (
                <div key={i} className="rune-card">
                  <div className="rune-name">{r.name}</div>
                  <div className="rune-meta">
                    {r.cost && <span>Cost: {r.cost}</span>}
                    {r.duration && <span>Duration: {r.duration}</span>}
                  </div>
                  <DescriptionList description={r.description} uniqueStatuses={uniqueStatus} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Showcase;
