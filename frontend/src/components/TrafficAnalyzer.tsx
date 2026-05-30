import React, { useState, useCallback } from 'react';
import { analyzeTrafficLogs, generateScriptFromTraffic } from '../api';
import {
  Upload, FileText, Zap, CheckCircle, AlertTriangle,
  Download, Users, ArrowRight, RefreshCw, ChevronDown,
  Activity, Code, BarChart2,
} from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';

type Step = 'upload' | 'journeys' | 'script';

interface Journey {
  name: string;
  frequency_pct: number;
  session_count: number;
  avg_steps: number;
  steps: Array<{
    endpoint: string;
    method: string;
    avg_duration_ms: number;
    think_time_ms: number;
    hit_count: number;
  }>;
}

interface AnalysisResult {
  format_detected: string;
  total_records: number;
  unique_endpoints: number;
  error_rate_pct: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  journeys: Journey[];
  endpoints: any[];
  ai_summary: string;
}

const TOOL_OPTIONS = [
  { value: 'k6', label: 'k6', lang: 'javascript' },
  { value: 'jmeter', label: 'JMeter (XML)', lang: 'xml' },
  { value: 'gatling', label: 'Gatling (Scala)', lang: 'scala' },
  { value: 'locust', label: 'Locust (Python)', lang: 'python' },
];

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  apache: 'Apache access log',
  nginx: 'Nginx access log',
  json: 'JSON / CloudWatch log',
  otel: 'OpenTelemetry trace export',
  har: 'Browser HAR capture',
};

export const TrafficAnalyzer: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedJourneys, setSelectedJourneys] = useState<Set<number>>(new Set());
  const [expandedJourney, setExpandedJourney] = useState<number | null>(0);
  const [tool, setTool] = useState('k6');
  const [scriptResult, setScriptResult] = useState<any>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(null); }
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeTrafficLogs(file, projectName || 'My Project');
      setAnalysis(result);
      // Select all journeys by default
      setSelectedJourneys(new Set(result.journeys.map((_: any, i: number) => i)));
      setStep('journeys');
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const sampleApache = `192.168.1.10 - - [30/May/2026:10:00:00 +0000] "GET /api/products HTTP/1.1" 200 1234 "-" "Mozilla/5.0" 45
192.168.1.11 - - [30/May/2026:10:00:02 +0000] "POST /api/cart HTTP/1.1" 200 512 "-" "Mozilla/5.0" 120
192.168.1.10 - - [30/May/2026:10:00:05 +0000] "POST /api/checkout HTTP/1.1" 200 1024 "-" "Mozilla/5.0" 350
10.0.0.5 - - [30/May/2026:10:01:00 +0000] "GET /index.html HTTP/1.1" 200 2048 "-" "Chrome" 20
10.0.0.5 - - [30/May/2026:10:01:03 +0000] "GET /api/products/1 HTTP/1.1" 200 800 "-" "Chrome" 35`;
    const f = new File([sampleApache], "demo_apache_traffic.log", { type: "text/plain" });
    setFile(f);
    setProjectName("Demo E-commerce");
    setTargetUrl("https://api.demo-ecommerce.com");
    setError(null);
  };

  const loadDemoJourneys = () => {
    const mockResult: AnalysisResult = {
      format_detected: "apache",
      total_records: 15420,
      unique_endpoints: 12,
      error_rate_pct: 0.5,
      p50_ms: 45,
      p95_ms: 210,
      p99_ms: 480,
      ai_summary: "Traffic patterns indicate typical e-commerce behavior with a primary 'Browse to Checkout' funnel. Latency is stable, but checkout endpoints occasionally spike near 500ms.",
      endpoints: [],
      journeys: [
        {
          name: "Browse to Checkout",
          frequency_pct: 65,
          session_count: 850,
          avg_steps: 4,
          steps: [
            { endpoint: "/index.html", method: "GET", avg_duration_ms: 25, think_time_ms: 2000, hit_count: 850 },
            { endpoint: "/api/products", method: "GET", avg_duration_ms: 45, think_time_ms: 5000, hit_count: 850 },
            { endpoint: "/api/cart", method: "POST", avg_duration_ms: 120, think_time_ms: 3000, hit_count: 500 },
            { endpoint: "/api/checkout", method: "POST", avg_duration_ms: 350, think_time_ms: 0, hit_count: 300 },
          ]
        },
        {
          name: "Direct Product View",
          frequency_pct: 35,
          session_count: 450,
          avg_steps: 2,
          steps: [
            { endpoint: "/api/products/1", method: "GET", avg_duration_ms: 35, think_time_ms: 4000, hit_count: 450 },
            { endpoint: "/api/cart", method: "POST", avg_duration_ms: 110, think_time_ms: 0, hit_count: 150 },
          ]
        }
      ]
    };
    setAnalysis(mockResult);
    setSelectedJourneys(new Set([0, 1]));
    setProjectName("Demo E-commerce");
    setStep('journeys');
    setError(null);
  };

  const handleGenerateScript = async () => {
    if (!analysis) return;
    setGeneratingScript(true);
    setError(null);
    try {
      const filteredJourneys = analysis.journeys.filter((_, i) => selectedJourneys.has(i));
      const result = await generateScriptFromTraffic({
        traffic_records: analysis.endpoints || [],
        journeys: filteredJourneys,
        tool,
        project_name: projectName || 'My Project',
      });
      setScriptResult(result);
      setStep('script');
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Script generation failed');
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleDownloadScript = () => {
    if (!scriptResult?.script) return;
    const ext: Record<string, string> = { javascript: 'js', python: 'py', scala: 'scala', xml: 'jmx', java: 'java' };
    const language = scriptResult.language || 'javascript';
    const blob = new Blob([scriptResult.script], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName || 'perfsight'}_${tool}_script.${ext[language] || 'txt'}`;
    a.click();
  };

  const toggleJourney = (i: number) => {
    setSelectedJourneys(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // ── Step: Upload ──
  if (step === 'upload') return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Traffic → Script Generator
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          Upload your production traffic logs or traces. The AI will analyze user behavior patterns,
          identify the most common journeys, and generate a realistic load test script — with real think times from production.
        </p>
      </div>

      {/* Accepted Formats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 18,
      }}>
        {[
          { icon: '📋', label: 'Apache / Nginx Logs', ext: '.log .txt' },
          { icon: '📦', label: 'JSON / CloudWatch', ext: '.json .ndjson' },
          { icon: '🔗', label: 'OpenTelemetry', ext: '.json (OTLP)' },
          { icon: '🌐', label: 'HAR Files', ext: '.har' },
          { icon: '📊', label: 'API Gateway Logs', ext: '.csv .log' },
          { icon: '📡', label: 'Distributed Traces', ext: 'OTEL JSON' },
        ].map(f => (
          <div key={f.label} style={{
            padding: '9px 11px', borderRadius: 7,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, marginBottom: 3 }}>{f.icon}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{f.ext}</div>
          </div>
        ))}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('traffic-file-input')?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--feuji-red)' : file ? 'var(--accent-green)' : 'var(--border)'}`,
          borderRadius: 10, padding: '32px 22px', textAlign: 'center',
          background: dragOver ? 'rgba(224,64,30,0.03)' : file ? 'rgba(22,163,74,0.02)' : 'var(--bg-secondary)',
          transition: 'all 0.2s', marginBottom: 14, cursor: 'pointer',
        }}
      >
        <input id="traffic-file-input" type="file" style={{ display: 'none' }}
          accept=".log,.txt,.json,.ndjson,.har,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(null); } }}
        />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <FileText size={22} color="var(--accent-green)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB — AI will auto-detect format
              </div>
            </div>
          </div>
        ) : (
          <>
            <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Drop your production log or trace file here
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              or click to browse · Format is auto-detected
            </div>
          </>
        )}
      </div>

      {/* Project + URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Name
          </label>
          <input className="input" placeholder="e.g. checkout-service" value={projectName}
            onChange={e => setProjectName(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Target Base URL (for script)
          </label>
          <input className="input" placeholder="https://your-api.com" value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)} type="url" />
        </div>
      </div>

      {error && (
        <div style={{ padding: '9px 13px', borderRadius: 7, background: 'var(--glow-red)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--accent-red)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={handleAnalyze} disabled={!file || loading}
          style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 14 }}>
          {loading
            ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Analyzing traffic patterns...</>
            : <><Activity size={15} /> Analyze Traffic & Detect User Journeys</>}
        </button>
        <button className="btn btn-ghost" onClick={loadSampleData} disabled={loading}
          style={{ flex: 1, justifyContent: 'center', fontSize: 13, border: '1px dashed var(--border)' }}>
          Load Sample Log
        </button>
        <button className="btn btn-ghost" onClick={loadDemoJourneys} disabled={loading}
          style={{ flex: 1, justifyContent: 'center', fontSize: 13, border: '1px dashed var(--border)' }}>
          Skip to Journeys
        </button>
      </div>
    </div>
  );

  // ── Step: Journeys ──
  if (step === 'journeys' && analysis) return (
    <div className="animate-fade-in">
      {/* Stats Row */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Requests', value: analysis.total_records.toLocaleString() },
          { label: 'Unique Endpoints', value: analysis.unique_endpoints },
          { label: 'p99 Latency', value: `${analysis.p99_ms}ms`, warn: analysis.p99_ms > 500 },
          { label: 'Error Rate', value: `${analysis.error_rate_pct}%`, warn: analysis.error_rate_pct > 1 },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px' }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ fontSize: 20, marginTop: 5, color: ('warn' in s && s.warn) ? 'var(--feuji-red)' : 'var(--text-primary)' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Format + AI Summary */}
      <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <CheckCircle size={14} color="var(--accent-green)" />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            Format Detected: <span style={{ color: 'var(--feuji-red)' }}>{FORMAT_DESCRIPTIONS[analysis.format_detected] || analysis.format_detected}</span>
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{analysis.ai_summary}</p>
      </div>

      {/* Journey Cards */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>
            {analysis.journeys.length} User Journeys Detected
          </h3>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedJourneys(new Set(analysis.journeys.map((_, i) => i)))}>
              Select All
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedJourneys(new Set())}>
              Deselect All
            </button>
          </div>
        </div>

        {analysis.journeys.map((journey, i) => (
          <div key={i} className="card" style={{
            marginBottom: 8, padding: '14px',
            borderColor: selectedJourneys.has(i) ? 'rgba(224,64,30,0.3)' : 'var(--border)',
            background: selectedJourneys.has(i) ? 'rgba(224,64,30,0.02)' : 'var(--bg-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={selectedJourneys.has(i)}
                onChange={() => toggleJourney(i)}
                style={{ width: 16, height: 16, accentColor: 'var(--feuji-red)', cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{journey.name}</span>
                  <span className="badge badge-primary" style={{ fontSize: 10.5 }}>{journey.frequency_pct}% of traffic</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>{journey.session_count} sessions</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>avg {journey.avg_steps} steps</span>
                </div>
              </div>
              <button onClick={() => setExpandedJourney(expandedJourney === i ? null : i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <ChevronDown size={14} style={{ transform: expandedJourney === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>

            {/* Step flow */}
            {expandedJourney === i && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Request Flow (from production data)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  {journey.steps.map((step, si) => (
                    <React.Fragment key={si}>
                      <div style={{
                        padding: '5px 10px', borderRadius: 6,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        fontSize: 11.5,
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10.5,
                          color: step.method === 'GET' ? 'var(--accent-green)' : step.method === 'POST' ? 'var(--feuji-amber)' : 'var(--feuji-red)',
                          fontWeight: 700, marginRight: 5,
                        }}>{step.method}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{step.endpoint.length > 30 ? step.endpoint.slice(0, 30) + '…' : step.endpoint}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 5, fontSize: 10 }}>{step.avg_duration_ms}ms</span>
                      </div>
                      {si < journey.steps.length - 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <ArrowRight size={12} color="var(--text-muted)" />
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{(step.think_time_ms / 1000).toFixed(1)}s</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tool Selection + Generate */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Output Tool
        </div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {TOOL_OPTIONS.map(t => (
            <button key={t.value} onClick={() => setTool(t.value)}
              style={{
                padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
                background: tool === t.value ? 'rgba(224,64,30,0.07)' : 'var(--bg-secondary)',
                border: `1px solid ${tool === t.value ? 'var(--feuji-red)' : 'var(--border)'}`,
                color: tool === t.value ? 'var(--feuji-red)' : 'var(--text-secondary)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--glow-red)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--accent-red)', fontSize: 12.5, marginBottom: 10, display: 'flex', gap: 6 }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setStep('upload'); setAnalysis(null); }} style={{ padding: '10px 18px' }}>
            <RefreshCw size={13} /> New Upload
          </button>
          <button className="btn btn-primary" onClick={handleGenerateScript}
            disabled={generatingScript || selectedJourneys.size === 0}
            style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
            {generatingScript
              ? <><div className="spinner" style={{ width: 15, height: 15 }} /> Generating {tool} script...</>
              : <><Code size={14} /> Generate {tool} Script from {selectedJourneys.size} Journey{selectedJourneys.size !== 1 ? 's' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Script ──
  if (step === 'script' && scriptResult) return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
            {scriptResult.tool?.toUpperCase()} Script Generated
          </h3>
          <div style={{ display: 'flex', gap: 7 }}>
            <span className="badge badge-primary">{scriptResult.scenario_count} scenarios</span>
            <span className="badge badge-neutral">{scriptResult.peak_vus} peak VUs</span>
            <span className="badge badge-neutral">{Math.round((scriptResult.estimated_duration_sec || 480) / 60)}min duration</span>
            <span className="badge badge-pass">Production-realistic</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep('journeys')}>
            <RefreshCw size={12} /> Back
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleDownloadScript}>
            <Download size={12} /> Download Script
          </button>
        </div>
      </div>

      {scriptResult.notes && (
        <div style={{ padding: '9px 13px', borderRadius: 7, background: 'var(--feuji-amber-glow)', border: '1px solid rgba(242,141,29,0.25)', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', gap: 7 }}>
          <AlertTriangle size={13} color="var(--feuji-amber)" style={{ flexShrink: 0 }} /> {scriptResult.notes}
        </div>
      )}

      {scriptResult.parameterized_variables?.length > 0 && (
        <div style={{ padding: '9px 13px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12.5, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 5, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Variables to configure before running:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {scriptResult.parameterized_variables.map((v: string, i: number) => (
              <span key={i} className="badge badge-warning" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Code size={13} color="var(--feuji-red)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {projectName || 'performance'}_script.{scriptResult.language === 'javascript' ? 'js' : scriptResult.language === 'python' ? 'py' : scriptResult.language === 'scala' ? 'scala' : 'jmx'}
          </span>
          <span className="badge badge-neutral" style={{ fontSize: 10.5, marginLeft: 'auto' }}>{scriptResult.language}</span>
        </div>
        <MonacoEditor
          height="520px"
          language={scriptResult.language || 'javascript'}
          value={scriptResult.script || '// Script generation failed'}
          theme="vs"
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, lineNumbers: 'on' }}
        />
      </div>
    </div>
  );

  return null;
};
