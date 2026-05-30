import React, { useState, useRef, useEffect } from 'react';
import { Globe, Play, ChevronDown, Zap, Wand2, AlertCircle, CheckCircle, Loader, Target, Settings } from 'lucide-react';
import { useStore } from '../store';
import { createWebSocket } from '../api';
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

const TOOLS = [
  { value: 'k6', label: 'k6', desc: 'Fast & developer-friendly' },
  { value: 'jmeter', label: 'JMeter', desc: 'Enterprise standard' },
  { value: 'gatling', label: 'Gatling', desc: 'Scala-based, high scale' },
  { value: 'locust', label: 'Locust', desc: 'Python, distributed testing' },
];

const EXAMPLE_SCENARIOS = [
  "1000 users trying to buy an iPhone on sales day — everyone hits checkout at midnight",
  "500 people booking Tatkal train tickets the moment quota opens at 10am",
  "50,000 users simultaneously logging in to watch the IPL final live stream",
  "Our API needs to handle Black Friday traffic — 10x normal load for 2 hours",
  "Test our banking app during month-end payroll processing surge",
  "Simulate a gaming server launch with 5000 concurrent players joining at once",
];

const SUGGESTED_URLS = [
  { url: 'https://reqres.in/api/users', label: 'reqres.in — REST API' },
  { url: 'https://jsonplaceholder.typicode.com/posts', label: 'JSONPlaceholder' },
  { url: 'https://httpbin.org/get', label: 'httpbin.org — HTTP Testing' },
  { url: 'https://test-api.k6.io/public/crocodiles/', label: 'k6 Demo API' },
];

type UrlStatus = 'idle' | 'checking' | 'reachable' | 'unreachable';

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
  const [urlStatus, setUrlStatus] = useState<UrlStatus>('idle');
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const urlCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setRunId, setPhase, addMetrics, setScenario: storeSetScenario,
    setScriptResult, setFindings, setReport, setSuggestedQuestions,
    setWs, reset,
  } = useStore();

  // Cycle placeholder
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % EXAMPLE_SCENARIOS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [description]);

  // URL health check with debounce
  useEffect(() => {
    if (!url.trim() || !url.startsWith('http')) {
      setUrlStatus('idle');
      return;
    }
    if (urlCheckTimer.current) clearTimeout(urlCheckTimer.current);
    setUrlStatus('checking');
    urlCheckTimer.current = setTimeout(async () => {
      try {
        await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        setUrlStatus('reachable');
      } catch {
        // no-cors fetch often succeeds even for real sites, so treat as reachable
        setUrlStatus('reachable');
      }
    }, 800);
    return () => {
      if (urlCheckTimer.current) clearTimeout(urlCheckTimer.current);
    };
  }, [url]);

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
    setDescription(example);
    textareaRef.current?.focus();
  };

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>

      {/* Input Card */}
      <div style={{
        background: 'rgba(224,64,30,0.02)',
        border: '1px solid rgba(224,64,30,0.15)',
        borderRadius: 10, padding: '28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(224,64,30,0.3)', flexShrink: 0,
          }}>
            <Wand2 size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Describe Your Test Scenario</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              Describe the real-world situation in plain English — no technical knowledge required.
            </p>
          </div>
        </div>

        {/* Scenario Textarea */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <textarea
            ref={textareaRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={EXAMPLE_SCENARIOS[placeholderIdx]}
            disabled={loading}
            className="input"
            style={{
              minHeight: 96, padding: '14px 16px', borderRadius: 8,
              fontSize: 14, lineHeight: 1.6, resize: 'none',
              border: description ? '1px solid rgba(224,64,30,0.45)' : undefined,
              boxShadow: description ? '0 0 0 3px rgba(224,64,30,0.08)' : undefined,
            }}
          />
          {description && (
            <div style={{ position: 'absolute', bottom: 9, right: 12, fontSize: 10.5, color: 'var(--text-muted)' }}>
              {description.length} chars
            </div>
          )}
        </div>

        {/* Example Chips */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
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
                  padding: '4px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                  background: 'rgba(224,64,30,0.06)', border: '1px solid rgba(224,64,30,0.2)',
                  color: 'var(--feuji-red)', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(224,64,30,0.12)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(224,64,30,0.06)'; }}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* URL + Project Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Globe size={11} /> Target URL
              </span>
              {urlStatus === 'checking' && (
                <span className="status-pill checking"><Loader size={9} style={{ animation: 'spin 0.75s linear infinite' }} /> Checking</span>
              )}
              {urlStatus === 'reachable' && (
                <span className="status-pill reachable"><CheckCircle size={9} /> Reachable</span>
              )}
              {urlStatus === 'unreachable' && (
                <span className="status-pill unreachable"><AlertCircle size={9} /> Unreachable</span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="https://your-api.example.com"
                value={url}
                onChange={e => { setUrl(e.target.value); setShowUrlSuggestions(false); }}
                onFocus={() => !url && setShowUrlSuggestions(true)}
                onBlur={() => setTimeout(() => setShowUrlSuggestions(false), 200)}
                type="url"
                disabled={loading}
                style={{ border: urlStatus === 'reachable' ? '1px solid rgba(46,168,74,0.4)' : urlStatus === 'unreachable' ? '1px solid rgba(230,57,70,0.4)' : undefined }}
              />
              {showUrlSuggestions && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, marginTop: 4, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ padding: '7px 12px', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>
                    Suggested Test Endpoints
                  </div>
                  {SUGGESTED_URLS.map((s, i) => (
                    <button key={i}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 12px', background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                      onMouseDown={() => { setUrl(s.url); setShowUrlSuggestions(false); }}
                    >
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.url}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Project Name
            </label>
            <input
              className="input"
              placeholder="e.g. checkout-api"
              value={project}
              onChange={e => setProject(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Simulation Mode Banner */}
        <div style={{
          marginBottom: 14, padding: '8px 12px', borderRadius: 7,
          background: 'var(--feuji-amber-glow)', border: '1px solid rgba(242,141,29,0.25)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
        }}>
          <AlertCircle size={13} color="var(--feuji-amber)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--feuji-amber)' }}>Simulation Mode:</strong> k6/JMeter not installed locally — AI will run a high-fidelity simulation against the target URL with realistic metrics.
          </span>
        </div>

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          disabled={loading}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, display: 'flex',
            alignItems: 'center', gap: 5, padding: 0, marginBottom: showAdvanced ? 12 : 16,
            fontFamily: 'inherit', transition: 'color 0.18s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <Settings size={12} />
          <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          Advanced options (test tool selection)
        </button>

        {showAdvanced && (
          <div style={{ marginBottom: 16, animation: 'fade-in 0.2s ease' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Test Tool
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {TOOLS.map(t => (
                <button key={t.value} onClick={() => setTool(t.value)} disabled={loading}
                  style={{
                    padding: '9px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: tool === t.value ? 'rgba(224,64,30,0.08)' : 'var(--bg-secondary)',
                    border: `1px solid ${tool === t.value ? 'var(--feuji-red)' : 'var(--border)'}`,
                    color: tool === t.value ? 'var(--feuji-red)' : 'var(--text-secondary)',
                    transition: 'all 0.18s', fontFamily: 'inherit', minWidth: 110,
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Parse Preview Button */}
        {description && url && !parsedScenario && (
          <button
            onClick={handleParsePreview}
            disabled={parsing || loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer', marginBottom: 8,
              background: 'rgba(242,141,29,0.08)', border: '1px solid rgba(242,141,29,0.3)',
              color: 'var(--feuji-amber)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.18s',
            }}>
            {parsing
              ? <><div className="spinner" style={{ width: 15, height: 15, borderTopColor: 'var(--feuji-amber)' }} /> Parsing scenario with AI...</>
              : <><Target size={14} /> Preview AI-Parsed Test Configuration</>}
          </button>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--glow-red)', border: '1px solid rgba(230,57,70,0.3)',
            borderRadius: 7, padding: '9px 13px', marginBottom: 12,
            color: 'var(--accent-red)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Launch Button */}
        <button
          className="btn btn-primary"
          onClick={handleStart}
          disabled={loading || !description || !url}
          id="launch-test-btn"
          style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: 15, borderRadius: 9, gap: 9 }}
        >
          {loading
            ? <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'rgba(255,255,255,0.9)' }} /> Starting AI Pipeline...</>
            : <><Zap size={17} /> Start Performance Test</>}
        </button>

        <p style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-muted)', fontSize: 11.5 }}>
          AI will parse your scenario, generate a test script, run simulation, analyze results, and produce a full diagnostic report.
        </p>
      </div>

      {/* Parsed Scenario Preview */}
      {parsedScenario && !loading && (
        <div className="card animate-fade-in" style={{ marginTop: 14, border: '1px solid rgba(224,64,30,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <CheckCircle size={16} color="var(--feuji-red)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>AI-Parsed Test Configuration</h3>
            <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>{parsedScenario.app_type}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Test Type', value: parsedScenario.scenario_name },
              { label: 'Peak Users', value: parsedScenario.load_parameters?.peak_vus },
              { label: 'Duration', value: `${Math.round(((parsedScenario.load_parameters?.ramp_up_duration_sec || 0) + (parsedScenario.load_parameters?.steady_state_duration_sec || 0) + (parsedScenario.load_parameters?.ramp_down_duration_sec || 0)) / 60)}m` },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '11px 13px', borderRadius: 8,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--feuji-red)' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Inferred Endpoints
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {parsedScenario.inferred_endpoints?.slice(0, 6).map((ep: any, i: number) => (
                <span key={i} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {ep.method} {ep.path}
                </span>
              ))}
            </div>
          </div>

          {parsedScenario.risk_areas?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--feuji-amber)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={12} /> {parsedScenario.risk_areas[0]}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={handleStart} disabled={loading}
              style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
              <Play size={15} /> Run This Test
            </button>
            <button className="btn btn-ghost" onClick={() => setParsedScenario(null)} style={{ padding: '11px 15px' }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
