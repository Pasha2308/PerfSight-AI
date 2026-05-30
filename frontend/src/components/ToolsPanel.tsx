import React, { useState, useCallback } from 'react';
import { correlateJmx, correlateHar, optimizeJmx, importJtl, importK6 } from '../api';
import { TrafficAnalyzer } from './TrafficAnalyzer';
import {
  Upload, FileCode, Zap, CheckCircle, AlertTriangle,
  Download, Shield, ArrowRight, FileText, BarChart2, Activity,
} from 'lucide-react';

type Mode = 'correlate' | 'import' | 'optimize' | 'traffic';

interface CorrelationResult {
  correlations_found: any[];
  total_correlations: number;
  correlated_jmx: string;
  original_samplers: number;
  summary: string;
  time_saved_hours: number;
  validation: { valid: boolean; message: string };
}

interface ImportResult {
  total_metrics: number;
  unique_endpoints: number;
  kpis: any;
  anomalies: any[];
  trend: any;
  ai_summary?: string;
  report?: any;
  findings?: any;
}

export function ToolsPanel() {
  const [mode, setMode] = useState<Mode>('correlate');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); setError(null); }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) { setFile(selected); setError(null); }
  };

  const clearResults = () => {
    setCorrelationResult(null);
    setImportResult(null);
    setOptimizeResult(null);
    setError(null);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    clearResults();
    try {
      if (mode === 'correlate') {
        const ext = file.name.toLowerCase();
        const result = ext.endsWith('.har')
          ? await correlateHar(file, file.name.replace(/\.har$/i, ''))
          : await correlateJmx(file);
        setCorrelationResult(result);
      } else if (mode === 'import') {
        const ext = file.name.toLowerCase();
        const result = ext.endsWith('.json')
          ? await importK6(file, file.name.replace(/\.json$/i, ''))
          : await importJtl(file, file.name.replace(/\.(jtl|csv)$/i, ''));
        setImportResult(result);
      } else if (mode === 'optimize') {
        setOptimizeResult(await optimizeJmx(file));
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadCorrelatedJmx = () => {
    if (!correlationResult?.correlated_jmx) return;
    const blob = new Blob([correlationResult.correlated_jmx], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `correlated_${file?.name || 'test.jmx'}`; a.click();
    URL.revokeObjectURL(url);
  };

  const MODES = [
    { key: 'traffic' as Mode, icon: <Activity size={13} />, label: 'Traffic → Script', desc: 'Upload logs/traces → AI generates realistic scripts' },
    { key: 'correlate' as Mode, icon: <Zap size={13} />, label: 'JMeter Correlator', desc: 'Auto-correlate dynamic values from JMX or HAR' },
    { key: 'import' as Mode, icon: <Upload size={13} />, label: 'Import Results', desc: 'Analyze JTL, k6 JSON, or CSV test output' },
    { key: 'optimize' as Mode, icon: <Shield size={13} />, label: 'JMX Optimizer', desc: 'Best practice review and quality scoring' },
  ];

  if (mode === 'traffic') return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        {MODES.map(tab => (
          <button key={tab.key}
            onClick={() => { setMode(tab.key); setFile(null); clearResults(); }}
            style={{
              flex: '0 0 auto', padding: '11px 13px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              background: mode === tab.key
                ? 'linear-gradient(135deg, rgba(224,64,30,0.08), rgba(242,141,29,0.05))'
                : 'var(--bg-secondary)',
              border: `1px solid ${mode === tab.key ? 'var(--feuji-red)' : 'var(--border)'}`,
              transition: 'all 0.18s', fontFamily: 'inherit', minWidth: 130,
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: mode === tab.key ? 'var(--feuji-red)' : 'var(--text-primary)',
              fontWeight: 600, fontSize: 12.5, marginBottom: 2,
            }}>
              {tab.icon} {tab.label}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tab.desc}</div>
          </button>
        ))}
      </div>
      <TrafficAnalyzer />
    </div>
  );

  return (
    <div>
      {/* Mode Selection */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
        {MODES.map(tab => (
          <button key={tab.key}
            onClick={() => { setMode(tab.key); setFile(null); clearResults(); }}
            style={{
              flex: 1, padding: '11px 13px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              background: mode === tab.key
                ? 'linear-gradient(135deg, rgba(224,64,30,0.08), rgba(242,141,29,0.05))'
                : 'var(--bg-secondary)',
              border: `1px solid ${mode === tab.key ? 'var(--feuji-red)' : 'var(--border)'}`,
              transition: 'all 0.18s', fontFamily: 'inherit',
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: mode === tab.key ? 'var(--feuji-red)' : 'var(--text-primary)',
              fontWeight: 600, fontSize: 13, marginBottom: 3,
            }}>
              {tab.icon} {tab.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('tools-file-input')?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--feuji-red)' : file ? 'var(--accent-green)' : 'var(--border)'}`,
          borderRadius: 10, padding: '26px 22px', textAlign: 'center',
          background: dragOver ? 'rgba(224,64,30,0.04)' : file ? 'rgba(46,168,74,0.03)' : 'transparent',
          transition: 'all 0.2s', marginBottom: 14, cursor: 'pointer',
        }}
      >
        <input
          id="tools-file-input" type="file" onChange={handleFileSelect} style={{ display: 'none' }}
          accept={mode === 'correlate' ? '.jmx,.har' : mode === 'optimize' ? '.jmx' : '.jtl,.csv,.json'}
        />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <FileCode size={20} color="var(--accent-green)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{file.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
        ) : (
          <>
            <Upload size={26} color="var(--text-muted)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {mode === 'correlate' ? 'Drop JMX or HAR file here' :
               mode === 'import' ? 'Drop JTL, k6 JSON, or CSV results file' :
               'Drop JMX file for optimization review'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>or click to browse</div>
          </>
        )}
      </div>

      {/* Process Button */}
      {file && !loading && !correlationResult && !importResult && !optimizeResult && (
        <button onClick={handleProcess} className="btn btn-primary"
          style={{ width: '100%', padding: '11px 0', fontSize: 13.5, fontWeight: 600, borderRadius: 8, marginBottom: 14, justifyContent: 'center' }}>
          <Zap size={14} />
          {mode === 'correlate' ? 'Auto-Correlate Dynamic Values' :
           mode === 'import' ? 'Analyze Test Results' : 'Run Optimization Review'}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <div className="spinner" style={{ width: 30, height: 30, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
            {mode === 'correlate' ? 'Analyzing test plan for dynamic values...' :
             mode === 'import' ? 'Running ML analysis pipeline on test data...' :
             'Reviewing JMX for best practices...'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>This typically takes 30–60 seconds</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, background: 'var(--glow-red)',
          border: '1px solid rgba(230,57,70,0.3)', marginBottom: 14,
          fontSize: 13, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {correlationResult && <CorrelationResults result={correlationResult} onDownload={downloadCorrelatedJmx} />}
      {importResult && <ImportResults result={importResult} />}
      {optimizeResult && <OptimizeResults result={optimizeResult} />}
    </div>
  );
}

function CorrelationResults({ result, onDownload }: { result: CorrelationResult; onDownload: () => void }) {
  return (
    <div className="animate-fade-in">
      <div style={{
        padding: '15px 18px', borderRadius: 10, marginBottom: 14,
        background: 'rgba(224,64,30,0.05)', border: '1px solid rgba(224,64,30,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={18} color="var(--accent-green)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Correlation Complete</span>
          </div>
          <button onClick={onDownload} className="btn btn-primary btn-sm">
            <Download size={13} /> Download Correlated JMX
          </button>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Stat label="Correlations Applied" value={result.total_correlations} color="var(--feuji-red)" />
          <Stat label="Samplers Analyzed" value={result.original_samplers} color="var(--text-secondary)" />
          <Stat label="Time Saved" value={`${result.time_saved_hours}h`} color="var(--accent-green)" />
          <Stat label="JMX Valid" value={result.validation?.valid ? 'Yes' : 'No'} color={result.validation?.valid ? 'var(--accent-green)' : 'var(--feuji-amber)'} />
        </div>
      </div>

      {result.correlations_found?.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Correlated Values
          </div>
          {result.correlations_found.map((c: any, i: number) => (
            <div key={i} style={{
              padding: '9px 13px', borderRadius: 7, marginBottom: 6,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: c.priority === 'critical' ? 'var(--feuji-red)' : c.priority === 'high' ? 'var(--feuji-amber)' : 'var(--accent-green)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <code style={{ fontSize: 12, color: 'var(--feuji-amber)', fontWeight: 600 }}>
                    ${'{' + c.variable_name + '}'}
                  </code>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{c.extraction_type}</span>
                  <span className="badge badge-warning" style={{ fontSize: 10 }}>{c.priority}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span style={{ color: 'var(--accent-green)' }}>{c.source_sampler}</span>
                  <ArrowRight size={9} style={{ margin: '0 4px', verticalAlign: 'middle' }} />
                  {c.target_samplers?.join(', ') || 'subsequent requests'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportResults({ result }: { result: ImportResult }) {
  const kpis = result.kpis || {};
  return (
    <div className="animate-fade-in">
      <div style={{
        padding: '15px 18px', borderRadius: 10, marginBottom: 14,
        background: 'rgba(46,168,74,0.05)', border: '1px solid rgba(46,168,74,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BarChart2 size={18} color="var(--accent-green)" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Analysis Complete</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Stat label="Total Requests" value={result.total_metrics?.toLocaleString()} color="var(--text-primary)" />
          <Stat label="Endpoints" value={result.unique_endpoints} color="var(--feuji-red)" />
          <Stat label="p99 Latency" value={`${kpis.p99_ms?.toFixed(0) || 0}ms`} color={kpis.p99_ms > 500 ? 'var(--feuji-red)' : 'var(--accent-green)'} />
          <Stat label="Error Rate" value={`${kpis.error_rate_pct?.toFixed(2) || 0}%`} color={kpis.error_rate_pct > 1 ? 'var(--feuji-red)' : 'var(--accent-green)'} />
          <Stat label="Health Score" value={`${kpis.health_score || 0}/100`} color="var(--feuji-amber)" />
        </div>
      </div>

      {result.ai_summary && (
        <div style={{
          padding: '11px 14px', borderRadius: 8, background: 'var(--bg-card)',
          border: '1px solid var(--border)', marginBottom: 14, fontSize: 13,
          color: 'var(--text-secondary)', lineHeight: 1.65,
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Assessment
          </div>
          {result.ai_summary}
        </div>
      )}

      {result.anomalies?.length > 0 && (
        <div style={{
          padding: '11px 14px', borderRadius: 8,
          background: 'var(--glow-red)', border: '1px solid rgba(230,57,70,0.2)', fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--feuji-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> {result.anomalies.length} Anomalies Detected
          </div>
          {result.anomalies.slice(0, 5).map((a: any, i: number) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
              [{a.severity}] {a.type} at {a.timestamp_label} — {a.spike_ratio ? `${a.spike_ratio}x baseline` : `${a.error_rate_pct}% errors`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptimizeResults({ result }: { result: any }) {
  const issues = result.issues || [];
  const score = result.overall_quality_score || 0;
  return (
    <div className="animate-fade-in">
      <div style={{
        padding: '15px 18px', borderRadius: 10, marginBottom: 14,
        background: score >= 80 ? 'rgba(46,168,74,0.05)' : score >= 50 ? 'rgba(242,141,29,0.05)' : 'rgba(224,64,30,0.05)',
        border: `1px solid ${score >= 80 ? 'rgba(46,168,74,0.2)' : score >= 50 ? 'rgba(242,141,29,0.2)' : 'rgba(224,64,30,0.2)'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>JMX Quality Score</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{result.summary}</div>
          </div>
          <div style={{
            fontSize: 34, fontWeight: 800,
            color: score >= 80 ? 'var(--accent-green)' : score >= 50 ? 'var(--feuji-amber)' : 'var(--feuji-red)',
          }}>
            {score}
          </div>
        </div>
      </div>

      {issues.map((issue: any, i: number) => (
        <div key={i} style={{
          padding: '10px 13px', borderRadius: 7, marginBottom: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {issue.severity === 'critical'
              ? <AlertTriangle size={13} color="var(--feuji-red)" />
              : issue.severity === 'warning'
              ? <AlertTriangle size={13} color="var(--feuji-amber)" />
              : <FileText size={13} color="var(--text-secondary)" />}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{issue.description}</span>
            <span className={`badge ${issue.severity === 'critical' ? 'badge-primary' : issue.severity === 'warning' ? 'badge-warning' : 'badge-neutral'}`}
              style={{ fontSize: 10, marginLeft: 'auto' }}>
              {issue.severity}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent-green)', marginLeft: 19 }}>{issue.recommendation}</div>
          {issue.estimated_impact && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 19, marginTop: 2 }}>
              Impact: {issue.estimated_impact}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  );
}
