import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, AlertCircle, Check, Download, Upload } from 'lucide-react';

const Editor = ({ data, onSave }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic validation
      if (!parsed.stats || !parsed.skills || !parsed.uniqueStatus) {
        throw new Error("Missing required fields: stats, skills, uniqueStatus");
      }
      onSave(parsed);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Invalid JSON format. Please check for missing quotes or commas.");
      setSaved(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arthur-pendragon-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        JSON.parse(text); // validate
        setJsonText(text);
        setError(null);
      } catch {
        setError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="stack-lg">
      {/* Toolbar */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Skill Kit Editor</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Edit the JSON data directly. Add new skills, passives, or statuses. Use standard double quotes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-ghost" onClick={handleExport}>
            <Download size={14} /> Export
          </button>
          <button className="btn btn-success" onClick={handleSave}>
            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'var(--accent-red-bg)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      <textarea
        value={jsonText}
        onChange={(e) => { setJsonText(e.target.value); setSaved(false); }}
        className="editor-textarea"
        spellCheck="false"
      />

      {/* Help Guide */}
      <div className="card" style={{ padding: '1rem 1.5rem' }}>
        <h3 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
          Quick Guide — Adding New Items
        </h3>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          <p><strong>Add a Skill:</strong> Add an object to the <code>"skills"</code> array with fields: <code>name</code>, <code>level</code>, <code>type</code>, <code>cooldown</code>, <code>cost</code> (optional), <code>description</code></p>
          <p style={{ marginTop: '0.3rem' }}><strong>Add a Status:</strong> Add to <code>"uniqueStatus"</code> with: <code>name</code>, <code>description</code></p>
          <p style={{ marginTop: '0.3rem' }}><strong>Add a Passive:</strong> Add to <code>"passives"</code> with: <code>name</code>, <code>description</code></p>
          <p style={{ marginTop: '0.3rem' }}><strong>Add a Rune:</strong> Add to <code>"runes"</code> with: <code>name</code>, <code>cost</code>, <code>duration</code>, <code>description</code></p>
          <p style={{ marginTop: '0.3rem' }}><strong>Reference Statuses:</strong> Wrap in brackets like <code>[Sovereign Will]</code> in any description to enable tooltips.</p>
        </div>
      </div>
    </div>
  );
};

export default Editor;
