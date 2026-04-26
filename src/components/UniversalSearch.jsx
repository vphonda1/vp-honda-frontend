// ════════════════════════════════════════════════════════════════════════════
// UniversalSearch.jsx — VP Honda Smart Search Bar
// ════════════════════════════════════════════════════════════════════════════
// Floating search button + full-screen search overlay
// Searches across customers, vehicles, invoices, parts in one go
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { universalSearch } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

export default function UniversalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [data, setData] = useState({ customers: [], vehicles: [], invoices: [], parts: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Load data when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(api('/api/parts')).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(api('/api/invoices')).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([customers, parts, invoices]) => {
      setData({
        customers: customers || [],
        parts: parts || [],
        invoices: invoices || [],
        vehicles: customers.flatMap(c => c.vehicleModel ? [{...c}] : []),
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  // Run search whenever query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const found = universalSearch(query, data);
    setResults(found);
  }, [query, data]);

  const handleResultClick = (result) => {
    setOpen(false);
    setQuery('');
    if (result.link) navigate(result.link);
  };

  return (
    <>
      {/* Floating Search Button (always visible top-right) */}
      <button
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
        style={{
          position: 'fixed',
          top: 80,
          right: 16,
          zIndex: 40,
          background: 'linear-gradient(135deg, #DC0000, #B91C1C)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(220,0,0,0.4)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Search size={20}/>
      </button>

      {/* Search Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '60px 16px 20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 16,
              width: '100%',
              maxWidth: 640,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Search input */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Search size={20} color="#94a3b8" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Customer name, mobile, chassis, invoice... यहाँ search करें"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: 16,
                  padding: '6px 0',
                }}
              />
              <button
                onClick={() => setOpen(false)}
                style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 11 }}
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {loading && (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  ⏳ Loading data...
                </div>
              )}

              {!loading && query.length < 2 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  <p style={{ marginBottom: 12 }}>🔍 कम से कम 2 अक्षर टाइप करें</p>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <p>💡 आप ये search कर सकते हैं:</p>
                    <p>• Customer name (e.g., "Mohan")</p>
                    <p>• Mobile number (e.g., "8959")</p>
                    <p>• Chassis number (e.g., "ME4JK")</p>
                    <p>• Invoice number (e.g., "SMH/25-26")</p>
                    <p>• Part name (e.g., "brake")</p>
                    <p style={{ marginTop: 12, color: '#475569' }}>Tip: Ctrl+K shortcut से कहीं से भी search खुलेगा</p>
                  </div>
                </div>
              )}

              {!loading && query.length >= 2 && results.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  कोई result नहीं मिला "{query}" के लिए
                </div>
              )}

              {!loading && results.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {results.length} result{results.length === 1 ? '' : 's'} मिले
                  </div>
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleResultClick(r)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: '12px 16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'background 0.15s',
                        borderBottom: '1px solid #1e293b',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 24 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.title}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.subtitle}
                        </div>
                      </div>
                      <span style={{
                        background: typeColor(r.type).bg,
                        color: typeColor(r.type).fg,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}>
                        {r.type}
                      </span>
                      <ArrowRight size={14} color="#64748b" />
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #334155', color: '#64748b', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
              <span>↑↓ navigate · ↵ select · ESC close</span>
              <span>VP Honda</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const typeColor = (type) => {
  const map = {
    customer: { bg: '#1e3a8a55', fg: '#93c5fd' },
    vehicle:  { bg: '#16a34a55', fg: '#86efac' },
    invoice:  { bg: '#ea580c55', fg: '#fdba74' },
    part:     { bg: '#a855f755', fg: '#d8b4fe' },
  };
  return map[type] || { bg: '#33415555', fg: '#cbd5e1' };
};