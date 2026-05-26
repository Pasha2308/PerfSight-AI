import React, { useState } from 'react';
import { useStore } from '../store';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, FileText, Wrench, Eye } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import MonacoEditor from '@monaco-editor/react';

export const ReportView: React.FC = () => {
  const { report, findings, scriptResult, scenario } = useStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'remediation' | 'script'>('overview');
  const [expandedCause, setExpandedCause] = useState<number | null>(0);

  if (!report) return null;

  const verdict = report.verdict || {};
  const kpis = report.kpis || {};
  const anomalies: any[] = report.anomalies || [];
  const rootCauses: any[] = report.root_causes || [];
  const correlations: any[] = report.correlations || [];
  const trend = report.trend || {};

  const isPassed = verdict.status === 'PASS';

  // Anomaly timeline chart
  const anomalyChartOpts = anomalies.length > 0 ? {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 50, left: 60 },
    tooltip: {
      trigger: 'item', backgroundColor: '#1a2332', borderColor: '#2d4a6e',
      textStyle: { color: '#e6edf3', fontSize: 12 },
      formatter: (p: any) => `<b>${p.data[3]}</b><br/>Severity: ${p.data[4]}<br/>Confidence: ${p.data[5]}%`,
    },
    xAxis: { type: 'value', name: 'Elapsed (ms)', axisLabel: { color: '#484f58', fontSize: 10, formatter: (v: number) => `${Math.floor(v/60000)}m${Math.floor((v%60000)/1000)}s` }, splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } }, axisLine: { lineStyle: { color: '#1e2d3d' } } },
    yAxis: { type: 'value', name: 'Latency (ms)', axisLabel: { color: '#484f58', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } }, axisLine: { show: false } },
    series: [{
      type: 'scatter', symbolSize: 16,
      data: anomalies.map(a => [
        a.timestamp, a.window_mean_ms || 0, a.severity,
        a.type, a.severity, a.confidence,
      ]),
      itemStyle: { color: (p: any) => p.data[2] === 'CRITICAL' ? '#f85149' : '#d29922' },
      label: { show: false },
    }],
  } : null;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Verdict Banner */}
      <div className={`card ${isPassed ? '' : 'card-glow'}`} style={{
        borderColor: isPassed ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)',
        background: isPassed ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)',
        boxShadow: isPassed ? '0 0 20px rgba(63,185,80,0.15)' : '0 0 20px rgba(248,81,73,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isPassed
              ? <CheckCircle size={40} color="var(--accent-green)" />
              : <XCircle size={40} color="var(--accent-red)" />}
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: isPassed ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {verdict.status} — {isPassed ? 'All SLAs Met ✓' : 'SLA Violations Detected'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{verdict.summary}</div>
              {verdict.failures?.map((f: string, i: number) => (
                <div key={i} style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 3 }}>✗ {f}</div>
              ))}
              {verdict.warnings?.map((w: string, i: number) => (
                <div key={i} style={{ color: 'var(--accent-yellow)', fontSize: 12, marginTop: 3 }}>⚠ {w}</div>
              ))}
            </div>
          </div>
          {/* Health Score Ring */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `conic-gradient(${verdict.health_score > 70 ? '#3fb950' : verdict.health_score > 40 ? '#d29922' : '#f85149'} ${verdict.health_score * 3.6}deg, #1e2d3d 0deg)`,
              boxShadow: '0 0 20px rgba(88,166,255,0.2)',
            }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{verdict.health_score}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>HEALTH</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Apdex: {verdict.apdex}</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        {[
          { label: 'p99 Latency', value: `${kpis.p99_ms}ms`, sub: `p95: ${kpis.p95_ms}ms`, warn: kpis.p99_ms > (report.sla_targets?.p99_ms || 500) },
          { label: 'Error Rate', value: `${kpis.error_rate_pct}%`, sub: `${kpis.error_count} errors`, warn: kpis.error_rate_pct > 1 },
          { label: 'Throughput', value: `${kpis.throughput_rps} RPS`, sub: `${kpis.total_requests} total`, warn: false },
          { label: 'Mean Latency', value: `${kpis.mean_ms}ms`, sub: `p50: ${kpis.p50_ms}ms`, warn: false },
        ].map(k => (
          <div key={k.label} className="card">
            <div className="metric-label">{k.label}</div>
            <div className="metric-value" style={{ fontSize: 22, marginTop: 6, color: k.warn ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Trend indicator */}
      {trend.trend && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          {trend.trend === 'degrading' ? <TrendingUp size={20} color="var(--accent-red)" /> :
           trend.trend === 'improving' ? <TrendingDown size={20} color="var(--accent-green)" /> :
           <Minus size={20} color="var(--text-secondary)" />}
          <div>
            <span style={{ fontWeight: 600, color: trend.trend === 'degrading' ? 'var(--accent-red)' : trend.trend === 'improving' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              {trend.trend === 'degrading' ? '⚠ Degrading Trend Detected' : trend.trend === 'improving' ? '✓ Improving Trend' : '→ Stable Performance'}
            </span>
            {trend.verdict && <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>{trend.verdict}</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ padding: 0 }}>
        <div className="tabs" style={{ padding: '0 20px' }}>
          {[
            { key: 'overview', label: '📋 Overview', icon: <Eye size={14} /> },
            { key: 'technical', label: '🔬 Technical RCA', icon: <FileText size={14} /> },
            { key: 'remediation', label: '🛠 Remediation', icon: <Wrench size={14} /> },
            { key: 'script', label: '📄 Script', icon: <FileText size={14} /> },
          ].map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key as any)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Executive Summary */}
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 10, color: 'var(--accent-blue)' }}>Executive Summary</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{report.executive_summary}</p>
              </div>
              <hr className="divider" />
              {/* Key Observations */}
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 10 }}>Key Observations</h3>
                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>
                  {report.key_observations}
                </div>
              </div>
              {/* Root Causes */}
              {rootCauses.length > 0 && (
                <>
                  <hr className="divider" />
                  <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Root Causes (Ranked by Confidence)</h3>
                    {rootCauses.map((rc: any, i) => (
                      <div key={i} className={`root-cause-card ${rc.confidence > 80 ? 'high' : rc.confidence > 60 ? 'medium' : ''}`}
                        style={{ cursor: 'pointer' }} onClick={() => setExpandedCause(expandedCause === i ? null : i)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)', minWidth: 24 }}>#{rc.rank}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{rc.cause}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>Type: {rc.type}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: rc.confidence > 80 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>{rc.confidence}%</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>confidence</div>
                            </div>
                            {expandedCause === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                        {expandedCause === i && rc.evidence && (
                          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            Evidence: {rc.evidence}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {/* Anomaly Timeline */}
              {anomalies.length > 0 && (
                <>
                  <hr className="divider" />
                  <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Anomaly Timeline ({anomalies.length} detected)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {anomalies.map((a: any, i) => (
                        <div key={i} className={`anomaly-marker ${a.severity === 'WARNING' ? 'warning' : ''}`}>
                          {a.severity === 'CRITICAL' ? '🔴' : '🟡'} {a.timestamp_label} — {a.type.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                    {anomalyChartOpts && <ReactECharts option={anomalyChartOpts} style={{ height: 180 }} />}
                  </div>
                </>
              )}
              {/* Correlations */}
              {correlations.length > 0 && (
                <>
                  <hr className="divider" />
                  <div>
                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Cross-Layer Correlations</h3>
                    {correlations.map((c: any, i) => (
                      <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{c.infra_metric}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: Math.abs(c.correlation) > 0.8 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
                            r = {c.correlation} ({c.confidence}% confidence)
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'technical' && (
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 12, color: 'var(--accent-blue)' }}>Technical Root Cause Analysis</h3>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
                {report.technical_rca}
              </div>
            </div>
          )}

          {activeTab === 'remediation' && (
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 12, color: 'var(--accent-green)' }}>Remediation Steps</h3>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
                {report.remediation_steps}
              </div>
            </div>
          )}

          {activeTab === 'script' && scriptResult && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15 }}>Generated {scriptResult.tool?.toUpperCase()} Script</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-info">{scriptResult.language}</span>
                  <span className="badge badge-purple">~{scriptResult.estimated_duration_sec}s duration</span>
                  <span className="badge badge-info">{scriptResult.peak_vus} peak VUs</span>
                </div>
              </div>
              <MonacoEditor
                height="450px"
                language={scriptResult.language}
                value={scriptResult.script}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, lineNumbers: 'on' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
