import React, { useState, useEffect } from 'react';
import PlaySheet from './components/PlaySheet';
import Showcase from './components/Showcase';
import Editor from './components/Editor';
import initialData from './data.json';
import { Moon, Sun, Swords, BookOpen, Settings } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('play');
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('arthurData');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('arthurTheme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('arthurTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSaveData = (newData) => {
    setData(newData);
    localStorage.setItem('arthurData', JSON.stringify(newData));
  };

  const tabs = [
    { id: 'play', label: 'Ready to Play', icon: Swords },
    { id: 'showcase', label: 'Skill Kit', icon: BookOpen },
    { id: 'editor', label: 'Editor', icon: Settings },
  ];

  return (
    <div className="app-shell">

      {/* ===== Header ===== */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <img src="/logo.png" alt="" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
            <div>
              <div className="header-title">Arthur Pendragon</div>
              <div className="header-subtitle">Sacred Paladin</div>
            </div>
          </div>
          <div className="header-right">
            <button
              onClick={toggleTheme}
              className="btn btn-icon btn-ghost"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Tab Navigation ===== */}
      <nav className="nav-tabs">
        <div className="nav-tabs-inner">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ===== Main Content ===== */}
      <main className="main-content">
        {activeTab === 'play' && <PlaySheet data={data} />}
        {activeTab === 'showcase' && <Showcase data={data} />}
        {activeTab === 'editor' && <Editor data={data} onSave={handleSaveData} />}
      </main>
    </div>
  );
}

export default App;
