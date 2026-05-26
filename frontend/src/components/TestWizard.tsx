import React, { useState } from 'react';
import { Zap, Globe, Settings, Play, ChevronDown } from 'lucide-react';
import { startTest, createWebSocket } from '../api';
import { useStore } from '../store';

const SCENARIOS = [
  { value: 'load',       label: 'Load Test',       icon: '📊', desc: 'Steady expected traffic — validate SLAs' },
  { value: 'spike',      label: 'Spike Test',       icon: '⚡', desc: 'Sudden 10x burst — simulate flash sales' },
  { value: 'stress',     label: 'Stress Test',      icon: '🔥', desc: 'Gradually push until system breaks' },
  { value: 'soak',       label: 'Soak Test',        icon: '🌊', desc: 'Sustained load — detect memory leaks' },
  { value: 'breakpoint', label: 'Breakpoint Test',  icon: '💥', desc: 'Find absolute maximum capacity' },
];

const TOOLS = [
  { value: 'k6',      label: 'k6',       icon: '🎯' },
  { value: 'jmeter',  label: 'JMeter',   icon: '⚙️' },
  { value: 'gatling', label: 'Gatling',  icon: '🏹' },
  { value: 'locust',  label: 'Locust',   icon: '🦗' },
];

export const TestWizard: React.FC = () => {
  const [url, setUrl] = useState('');
  const [project, setProject] = useState('');
  const [scenario, setScenario] = useState('spike');
  const [tool, setTool] = useState('k6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setRunId, setPhase, addMetrics, setScenario: storeSetScenario,
          setScriptResult, setFindings, setReport, setSuggestedQuestions,
          setWs, reset } = useStore();

  const handleStart = async () => {
    if (!url.trim()) { setError('Please enter a target URL'); return; }
    if (!project.trim()) { setError('Please enter a project name'); return; }
    setError('');
    setLoading(true);
    reset();

    try {
      const result = await startTest({ project_name: project, target_url: url, scenario_type: scenario, tool });
      const { run_id } = result;
      setRunId(run_id);

      // Connect WebSocket
      const ws = createWebSocket(run_id);
      setWs(ws);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const { phase, status, message, data } = msg;

        setPhase(phase, status, message, data);

        if (phase === 'scenario' && data) storeSetScenario(data);
        if (phase === 'scripting' && data) setScriptResult(data);
        if (phase === 'executing' && data?.metrics) {
          addMetrics(data.metrics, data.infra, data.vus, data.progress_pct);
        }
        if (phase === 'analyzing' && data) setFindings(data);
        if (phase === 'reporting' && data) {
          setReport(data);
          if (msg.suggested_questions) setSuggestedQuestions(msg.suggested_questions);
        }
        if (phase === 'qa_ready' && msg.suggested_questions) {
          setSuggestedQuestions(msg.suggested_questions);
        }
      };

    } catch (e: any) {
      setError(e.message || 'Failed to start test');
    } finally {
      setLoading(false);
    }
  };

  const selectedScenario = SCENARIOS.find(s => s.value === scenario);

  return (
    <div className="card animate-fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
        }}>
          <Zap size={22} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 2 }}>New Performance Test</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            AI will generate the script, run the test, and analyze results automatically
          </p>
        </div>
      </div>

      {/* Project + URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
            PROJECT NAME
          </label>
          <input className="input" placeholder="e.g. checkout-service" value={project}
            onChange={e => setProject(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
            <Globe size={12} /> TARGET URL
          </label>
          <input className="input" placeholder="https://your-api.example.com" value={url}
            onChange={e => setUrl(e.target.value)} type="url" />
        </div>
      </div>

      {/* Scenario Selection */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
          SCENARIO TYPE
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {SCENARIOS.map(s => (
            <button key={s.value} onClick={() => setScenario(s.value)}
              style={{
                padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                background: scenario === s.value ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${scenario === s.value ? 'var(--accent-blue)' : 'var(--border)'}`,
                color: scenario === s.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                transition: 'all 0.2s', fontFamily: 'inherit',
              }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{s.label}</div>
            </button>
          ))}
        </div>
        {selectedScenario && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, paddingLeft: 4 }}>
            {selectedScenario.icon} {selectedScenario.desc}
          </p>
        )}
      </div>

      {/* Tool Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
          <Settings size={12} /> TEST TOOL
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {TOOLS.map(t => (
            <button key={t.value} onClick={() => setTool(t.value)}
              style={{
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                background: tool === t.value ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${tool === t.value ? 'var(--accent-blue)' : 'var(--border)'}`,
                color: tool === t.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                transition: 'all 0.2s', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--glow-red)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--accent-red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleStart} disabled={loading}
        style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: 15 }}>
        {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Starting Pipeline...</> : <><Play size={18} /> Launch AI Performance Test</>}
      </button>

      <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        AI will automatically generate the script → run the test → analyze results → report findings
      </p>
    </div>
  );
};
