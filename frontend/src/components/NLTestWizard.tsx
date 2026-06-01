import React, { useState, useRef, useEffect } from 'react';
import { Globe, Play, ChevronDown, Zap, Wand2, AlertCircle, CheckCircle, Loader, Target, Settings, Code, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
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
  // Wizard steps: 1 = Setup, 2 = Script Review & Refine, 3 = Launch
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [project, setProject] = useState('');
  const [tool, setTool] = useState('k6');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedScenario, setParsedScenario] = useState<any>(null);
  const [scriptText, setScriptText] = useState('');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
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
        setUrlStatus('reachable');
      }
    }, 800);
    return () => {
      if (urlCheckTimer.current) clearTimeout(urlCheckTimer.current);
    };
  }, [url]);

  const handleGenerateScript = async () => {
    if (!description.trim() || !url.trim()) {
      setError('Please complete the description and target URL.');
      return;
    }
    setError('');
    setParsing(true);
    try {
      // Step A: Parse scenario description
      const scenarioRes = await API.post('/api/scenarios/parse', {
        description,
        target_url: url,
        project_name: project || 'My Project',
      });
      const scenarioData = scenarioRes.data;
      setParsedScenario(scenarioData);

      // Step B: Generate script
      const scriptRes = await API.post('/api/scripts/generate', {
        scenario: scenarioData,
        tool,
      });
      setScriptText(scriptRes.data.script);
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to generate test scenario and script');
    } finally {
      setParsing(false);
    }
  };

  const handleRefineScript = async () => {
    if (!refinementPrompt.trim()) return;
    setError('');
    setIsRefining(true);
    try {
      const result = await API.post('/api/scripts/refine', {
        script: scriptText,
        instruction: refinementPrompt,
        tool,
        scenario: parsedScenario,
      });
      setScriptText(result.data.script);
      setRefinementPrompt('');
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to refine script');
    } finally {
      setIsRefining(false);
    }
  };

  const handleStart = async () => {
    if (!description.trim() || !url.trim()) return;
    setError('');
    setLoading(true);
    reset();
    try {
      const result = await API.post('/api/tests/start-nl', {
        description,
        target_url: url,
        project_name: project || 'My Project',
        tool,
        custom_script: scriptText,
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
      setError(e.response?.data?.detail || e.message || 'Failed to start test execution');
      setLoading(false);
    }
  };

  const fillExample = (example: string) => {
    setDescription(example);
    textareaRef.current?.focus();
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* Wizard Header Progress */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 20px', marginBottom: 28, position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '50%', left: 40, right: 40, height: 2, background: 'var(--border)', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '50%', left: 40, width: `${(step - 1) * 50}%`, height: 2, background: 'var(--feuji-red)', zIndex: 1, transition: 'width 0.3s ease' }} />
        
        {[
          { num: 1, label: 'Configure scenario' },
          { num: 2, label: 'Refine & edit script' },
          { num: 3, label: 'Review & run test' }
        ].map(s => (
          <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step > s.num ? 'var(--feuji-red)' : step === s.num ? 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))' : 'var(--bg-secondary)',
              border: `2px solid ${step >= s.num ? 'var(--feuji-red)' : 'var(--border)'}`,
              color: step >= s.num ? '#ffffff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, transition: 'all 0.3s ease'
            }}>
              {step > s.num ? <CheckCircle size={16} color="white" /> : s.num}
            </div>
            <div style={{
              fontSize: 11.5, fontWeight: step === s.num ? 600 : 500,
              color: step === s.num ? 'var(--feuji-red)' : 'var(--text-muted)',
              marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          background: 'var(--glow-red)', border: '1px solid rgba(230,57,70,0.3)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          color: 'var(--accent-red)', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* STEP 1: CONFIGURE */}
      {step === 1 && (
        <div className="animate-fade-in" style={{
          background: 'rgba(224,64,30,0.01)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: 28,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(224,64,30,0.25)', flexShrink: 0,
            }}>
              <Wand2 size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Scenario Setup</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Describe what real-world events or APIs you want to performance test.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 14 }}>
            <textarea
              ref={textareaRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={EXAMPLE_SCENARIOS[placeholderIdx]}
              disabled={parsing}
              className="input"
              style={{
                minHeight: 110, padding: '14px 16px', borderRadius: 8,
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Try an example:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                'Flash sale spike — 1000 users buy iPhone at midnight',
                'IRCTC Tatkal quota opening — 500 users book simultaneously',
                'IPL live stream — 50K users tune in at match start',
                'API stress test — push until system breaks',
              ].map((ex, i) => (
                <button key={i} onClick={() => fillExample(ex)} disabled={parsing}
                  style={{
                    padding: '4px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                    background: 'rgba(224,64,30,0.05)', border: '1px solid rgba(224,64,30,0.18)',
                    color: 'var(--feuji-red)', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(224,64,30,0.1)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(224,64,30,0.05)'; }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* URL + Project Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Globe size={11} /> Target URL
                </span>
                {urlStatus === 'checking' && (
                  <span className="status-pill checking"><Loader size={9} style={{ animation: 'spin 0.75s linear infinite' }} /> Checking</span>
                )}
                {urlStatus === 'reachable' && (
                  <span className="status-pill reachable"><CheckCircle size={9} /> Reachable</span>
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
                  disabled={parsing}
                  style={{ border: urlStatus === 'reachable' ? '1px solid rgba(46,168,74,0.4)' : undefined }}
                />
                {showUrlSuggestions && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, marginTop: 4, overflow: 'hidden',
                    boxShadow: 'var(--shadow-lg)',
                  }}>
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
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.url}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{s.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Project Name
              </label>
              <input
                className="input"
                placeholder="e.g. user-service"
                value={project}
                onChange={e => setProject(e.target.value)}
                disabled={parsing}
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            disabled={parsing}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 11.5, display: 'flex',
              alignItems: 'center', gap: 5, padding: 0, marginBottom: showAdvanced ? 12 : 20,
              fontFamily: 'inherit',
            }}
          >
            <Settings size={12} />
            <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            Advanced options (test tool selection)
          </button>

          {showAdvanced && (
            <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
                Test Tool
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {TOOLS.map(t => (
                  <button key={t.value} onClick={() => setTool(t.value)} disabled={parsing}
                    style={{
                      padding: '8px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      background: tool === t.value ? 'rgba(224,64,30,0.08)' : 'var(--bg-card)',
                      border: `1px solid ${tool === t.value ? 'var(--feuji-red)' : 'var(--border)'}`,
                      color: tool === t.value ? 'var(--feuji-red)' : 'var(--text-secondary)',
                      transition: 'all 0.18s', fontFamily: 'inherit',
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.7 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            className="btn btn-primary"
            onClick={handleGenerateScript}
            disabled={parsing || !description.trim() || !url.trim()}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14.5, borderRadius: 8 }}
          >
            {parsing ? (
              <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing & Generating Script...</>
            ) : (
              <><Zap size={16} /> Generate Performance Test Script <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      )}

      {/* STEP 2: REVIEW & REFINE */}
      {step === 2 && (
        <div className="animate-fade-in" style={{
          border: '1px solid var(--border)',
          borderRadius: 10, padding: 24,
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(242,141,29,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Code size={18} color="var(--feuji-amber)" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Review Generated Script</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                  Inspect code or refine load parameters using conversational prompts.
                </p>
              </div>
            </div>
            <span className="badge badge-primary">{tool.toUpperCase()} Script</span>
          </div>

          {/* Code Area */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', height: 320, padding: '14px', borderRadius: 8,
                background: '#1e1e24', color: '#a9b2c3', border: '1px solid #2d2d35',
                fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.6,
                outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          {/* Natural Language Refinement Input */}
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 14, marginBottom: 20
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
              <Sparkles size={12} color="var(--feuji-amber)" /> Refine Script with AI
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="e.g., 'add authorization headers', 'change ramp-up to 5m', 'add random think time'..."
                value={refinementPrompt}
                onChange={e => setRefinementPrompt(e.target.value)}
                disabled={isRefining}
                onKeyDown={e => { if (e.key === 'Enter') handleRefineScript(); }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleRefineScript}
                disabled={isRefining || !refinementPrompt.trim()}
                style={{ padding: '0 16px', gap: 5 }}
              >
                {isRefining ? (
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>Refine</>
                )}
              </button>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>
              AI will automatically apply instructions to the code above, preserving structure and configurations.
            </p>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ gap: 6 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)} style={{ gap: 6 }}>
              Next: Ready to Run <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & EXECUTE */}
      {step === 3 && (
        <div className="animate-fade-in" style={{
          border: '1px solid var(--border)',
          borderRadius: 10, padding: 24,
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(224,64,30,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Zap size={18} color="var(--feuji-red)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ready to Launch</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                Finalize and begin your load test execution.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Target URL</div>
              <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{url}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Execution Tool</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--feuji-red)' }}>{tool.toUpperCase()}</div>
            </div>
          </div>

          {parsedScenario && (
            <div style={{ padding: 14, borderRadius: 8, border: '1px solid rgba(224,64,30,0.15)', background: 'rgba(224,64,30,0.01)', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Config Summary</span>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{parsedScenario.scenario_name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Peak VUs</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{parsedScenario.load_parameters?.peak_vus || 10}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Warmup</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{parsedScenario.load_parameters?.ramp_up_duration_sec || 0}s</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>SLA p99</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{parsedScenario.sla_targets?.p99_ms || 500}ms</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)} style={{ gap: 6 }} disabled={loading}>
              <ArrowLeft size={14} /> Back to Editor
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={loading}
              style={{ flex: 1, justifyContent: 'center', gap: 8, padding: '12px' }}
            >
              {loading ? (
                <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Booting up test agents...</>
              ) : (
                <><Play size={16} /> Run Performance Test</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
