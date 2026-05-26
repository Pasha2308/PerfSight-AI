import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Globe, Play, ChevronDown, ArrowRight, Zap, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { createWebSocket } from '../api';
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

const TOOLS = [
  { value: 'k6',      label: 'k6',      icon: '🎯', desc: 'Fast & developer-friendly' },
  { value: 'jmeter',  label: 'JMeter',  icon: '⚙️', desc: 'Enterprise standard' },
  { value: 'gatling', label: 'Gatling', icon: '🏹', desc: 'Scala-based, high scale' },
  { value: 'locust',  label: 'Locust',  icon: '🦗', desc: 'Python, distributed' },
];

// Animated placeholder scenarios that cycle through
const EXAMPLE_SCENARIOS = [
  "1000 users trying to buy an iPhone on Amazon sales day — everyone hits checkout at midnight...",
  "500 people booking Tatkal train tickets the moment quota opens at 10am...",
  "50,000 users simultaneously logging in to watch the IPL final live stream...",
  "Our API needs to handle Black Friday traffic — 10x normal load for 2 hours...",
  "Test our banking app during month-end payroll processing surge...",
  "Simulate a gaming server launch with 5000 concurrent players joining at once...",
];

export const NLTestWizard: React.FC = () => {
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [project, setProject] = useState('');
  const [tool, setTool] = useState('k6');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedScenario, setParsedScenario] = useState<any>(null);
  const [error, setError] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    setRunId, setPhase, addMetrics, setScenario: storeSetScenario,
    setScriptResult, setFindings, setReport, setSuggestedQuestions,
    setWs, reset,
  } = useStore();

  // Cycle placeholder text
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % EXAMPLE_SCENARIOS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [description]);

  const handleParsePreview = async () => {
    if (!description.trim() || !url.trim()) return;
    setParsing(true);
    setParsedScenario(null);
    try {
      const result = await API.post('/api/scenarios/parse', {
        description,
        target_url: url,
        project_name: project || 'My Project',
      });
      setParsedScenario(result.data);
    } catch (e: any) {
      setError(e.message || 'Failed to parse scenario');
    } finally {
      setParsing(false);
    }
  };

  const handleStart = async () => {
    if (!description.trim()) { setError('Please describe your scenario'); return; }
    if (!url.trim()) { setError('Please enter the target URL'); return; }
    setError('');
    setLoading(true);
    reset();

    try {
      const result = await API.post('/api/tests/start-nl', {
        description,
        target_url: url,
        project_name: project || 'My Project',
        tool,
      });
      const { run_id } = result.data;
      setRunId(run_id);

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

  const fillExample = (example: string) => {
    setDescription(example.replace(/\.\.\.$/, ''));
    textareaRef.current?.focus();
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Main input card */}
      <div className="card animate-fade-in" style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06))',
        border: '1px solid rgba(88,166,255,0.2)',
        padding: '32px',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(37,99,235,0.5)',
            flexShrink: 0,
          }}>
            <Wand2 size={26} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.02em' }}>
              Describe Your Scenario
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
              Tell AI what real-world situation you want to test — in plain English.
              No technical knowledge needed.
            </p>
          </div>
        </div>

        {/* NL Textarea — the hero input */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <textarea
            ref={textareaRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={EXAMPLE_SCENARIOS[placeholderIdx]}
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 100,
              padding: '16px 18px',
              borderRadius: 12,
              background: 'rgba(13,17,23,0.7)',
              border: `1px solid ${description ? 'rgba(88,166,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: 'var(--text-primary)',
              fontSize: 15,
              lineHeight: 1.6,
              resize: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxSizing: 'border-box',
              boxShadow: description ? '0 0 0 2px rgba(88,166,255,0.1)' : 'none',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(88,166,255,0.6)'; }}
            onBlur={e => { e.target.style.borderColor = description ? 'rgba(88,166,255,0.5)' : 'rgba(255,255,255,0.1)'; }}
          />
          {description && (
            <div style={{
              position: 'absolute', bottom: 10, right: 12,
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              {description.length} chars
            </div>
          )}
        </div>

        {/* Example chips */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Try an example:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              'Flash sale spike — 1000 users buy iPhone at midnight',
              'IRCTC Tatkal quota opening — 500 users book simultaneously',
              'IPL live stream — 50K users tune in at match start',
              'API stress test — push until system breaks',
            ].map((ex, i) => (
              <button key={i} onClick={() => fillExample(ex)} disabled={loading}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)',
                  color: 'var(--accent-blue)', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(88,166,255,0.15)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(88,166,255,0.08)'; }}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* URL + Project row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
              <Globe size={12} /> TARGET URL *
            </label>
            <input className="input" placeholder="https://your-api.example.com" value={url}
              onChange={e => setUrl(e.target.value)} type="url" disabled={loading} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
              PROJECT NAME
            </label>
            <input className="input" placeholder="e.g. checkout-api" value={project}
              onChange={e => setProject(e.target.value)} disabled={loading} />
          </div>
        </div>

        {/* Advanced: Tool selection */}
        <button onClick={() => setShowAdvanced(v => !v)} disabled={loading}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: showAdvanced ? 14 : 20,
            fontFamily: 'inherit', transition: 'color 0.2s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}>
          <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          Advanced options (test tool)
        </button>

        {showAdvanced && (
          <div style={{ marginBottom: 20, animation: 'fade-in 0.2s ease' }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
              TEST TOOL
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TOOLS.map(t => (
                <button key={t.value} onClick={() => setTool(t.value)} disabled={loading}
                  style={{
                    padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                    background: tool === t.value ? 'rgba(88,166,255,0.12)' : 'var(--bg-secondary)',
                    border: `1px solid ${tool === t.value ? 'var(--accent-blue)' : 'var(--border)'}`,
                    color: tool === t.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    transition: 'all 0.2s', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview button */}
        {description && url && !parsedScenario && (
          <button onClick={handleParsePreview} disabled={parsing || loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, cursor: 'pointer', marginBottom: 10,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
              color: 'var(--accent-purple)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}>
            {parsing ? (
              <><div className="spinner" style={{ width: 16, height: 16 }} /> AI is parsing your scenario...</>
            ) : (
              <><Sparkles size={16} /> Preview AI-generated test config</>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--glow-red)', border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            color: 'var(--accent-red)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Launch button */}
        <button className="btn btn-primary" onClick={handleStart} disabled={loading || !description || !url}
          id="launch-test-btn"
          style={{ width: '100%', justifyContent: 'center', padding: '16px 24px', fontSize: 16, borderRadius: 12, gap: 10 }}>
          {loading
            ? <><div className="spinner" style={{ width: 20, height: 20 }} /> Starting AI Pipeline...</>
            : <><Zap size={20} /> Launch AI Performance Test</>
          }
        </button>

        <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
          AI will parse your scenario → generate script → run test → analyze results → report findings
        </p>
      </div>

      {/* Parsed scenario preview card */}
      {parsedScenario && !loading && (
        <div className="card animate-fade-in" style={{ marginTop: 16, border: '1px solid rgba(88,166,255,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Sparkles size={18} color="var(--accent-blue)" />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>AI Parsed Scenario</h3>
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{parsedScenario.app_type}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Test Type', value: parsedScenario.scenario_name },
              { label: 'Peak Users', value: parsedScenario.load_parameters?.peak_vus },
              { label: 'Duration', value: `${Math.round(((parsedScenario.load_parameters?.ramp_up_duration_sec || 0) + (parsedScenario.load_parameters?.steady_state_duration_sec || 0) + (parsedScenario.load_parameters?.ramp_down_duration_sec || 0)) / 60)}m` },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>INFERRED ENDPOINTS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {parsedScenario.inferred_endpoints?.slice(0, 6).map((ep: any, i: number) => (
                <span key={i} className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {ep.method} {ep.path}
                </span>
              ))}
            </div>
          </div>

          {parsedScenario.risk_areas?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--accent-yellow)' }}>
              ⚠ {parsedScenario.risk_areas[0]}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={handleStart} disabled={loading}
              style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
              <Play size={16} /> Run This Test
            </button>
            <button className="btn btn-ghost" onClick={() => setParsedScenario(null)} style={{ padding: '12px 16px' }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
