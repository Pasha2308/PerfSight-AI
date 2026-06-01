import React, { useState } from 'react';
import { useStore } from '../store';
import {
  CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, LayoutDashboard, Cpu, Wrench, Code, Eye, Download,
} from 'lucide-react';
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

  const anomalyChartOpts = anomalies.length > 0 ? {
    backgroundColor: 'transparent',
    grid: { top: 16, right: 16, bottom: 44, left: 56 },
    tooltip: {
      trigger: 'item', backgroundColor: '#FFFFFF', borderColor: '#E5E7EB',
      textStyle: { color: '#111827', fontSize: 11.5 },
      formatter: (p: any) => `<b>${p.data[3]}</b><br/>Severity: ${p.data[4]}<br/>Confidence: ${p.data[5]}%`,
    },
    xAxis: {
      type: 'value', name: 'Elapsed (ms)',
      axisLabel: { color: '#9CA3AF', fontSize: 10, formatter: (v: number) => `${Math.floor(v / 60000)}m${Math.floor((v % 60000) / 1000)}s` },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
    },
    yAxis: {
      type: 'value', name: 'Latency (ms)',
      axisLabel: { color: '#9CA3AF', fontSize: 10 },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
      axisLine: { show: false },
    },
    series: [{
      type: 'scatter', symbolSize: 15,
      data: anomalies.map(a => [a.timestamp, a.window_mean_ms || 0, a.severity, a.type, a.severity, a.confidence]),
      itemStyle: { color: (p: any) => p.data[2] === 'CRITICAL' ? '#E0401E' : '#F28D1D' },
    }],
  } : null;

  const TABS = [
    { key: 'overview' as const, icon: <LayoutDashboard size={13} />, label: 'Overview' },
    { key: 'technical' as const, icon: <Cpu size={13} />, label: 'Technical RCA' },
    { key: 'remediation' as const, icon: <Wrench size={13} />, label: 'Remediation' },
    { key: 'script' as const, icon: <Code size={13} />, label: 'Script', show: !!scriptResult },
  ];

  const downloadScript = () => {
    if (!scriptResult) return;
    const blob = new Blob([scriptResult.script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extension = scriptResult.language === 'jmeter' ? 'jmx' : scriptResult.language === 'python' ? 'py' : 'js';
    a.download = `load_test_script.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Verdict Banner */}
      <div className="card" style={{
        borderColor: isPassed ? 'rgba(46,168,74,0.4)' : 'rgba(224,64,30,0.4)',
        background: isPassed ? 'rgba(46,168,74,0.05)' : 'rgba(224,64,30,0.05)',
        boxShadow: isPassed ? '0 0 18px rgba(46,168,74,0.12)' : '0 0 18px rgba(224,64,30,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isPassed
              ? <CheckCircle size={36} color="var(--accent-green)" />
              : <XCircle size={36} color="var(--feuji-red)" />}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: isPassed ? 'var(--accent-green)' : 'var(--feuji-red)' }}>
                {verdict.status} — {isPassed ? 'All SLAs Met' : 'SLA Violations Detected'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>{verdict.summary}</div>
              {verdict.failures?.map((f: string, i: number) => (
                <div key={i} style={{ color: 'var(--feuji-red)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <XCircle size={10} /> {f}
                </div>
              ))}
              {verdict.warnings?.map((w: string, i: number) => (
                <div key={i} style={{ color: 'var(--feuji-amber)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={10} /> {w}
                </div>
              ))}
            </div>
          </div>

          {/* Health Score Ring */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `conic-gradient(${verdict.health_score > 70 ? '#2ea84a' : verdict.health_score > 40 ? '#F28D1D' : '#E0401E'} ${verdict.health_score * 3.6}deg, #1e2438 0deg)`,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{verdict.health_score}</span>
                <span style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Health</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>Apdex: {verdict.apdex}</div>
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
          <div key={k.label} className="card" style={{ textAlign: 'center' }}>
            <div className="metric-label">{k.label}</div>
            <div className="metric-value" style={{ fontSize: 22, marginTop: 6, color: k.warn ? 'var(--feuji-red)' : 'var(--text-primary)' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Trend Indicator */}
      {trend.trend && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
          {trend.trend === 'degrading'
            ? <TrendingUp size={18} color="var(--feuji-red)" />
            : trend.trend === 'improving'
            ? <TrendingDown size={18} color="var(--accent-green)" />
            : <Minus size={18} color="var(--text-secondary)" />}
          <span style={{
            fontWeight: 600,
            color: trend.trend === 'degrading' ? 'var(--feuji-red)' : trend.trend === 'improving' ? 'var(--accent-green)' : 'var(--text-secondary)',
          }}>
            {trend.trend === 'degrading' ? 'Degrading Trend Detected' : trend.trend === 'improving' ? 'Improving Trend' : 'Stable Performance'}
          </span>
          {trend.verdict && <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 6 }}>{trend.verdict}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ padding: 0 }}>
        <div className="tabs" style={{ padding: '0 18px' }}>
          {TABS.filter(t => !('show' in t) || t.show).map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 18 }}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: 14, marginBottom: 8, color: 'var(--feuji-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={14} /> Executive Summary
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: 13.5 }}>{report.executive_summary}</p>
              </div>
              <hr className="divider" />
              <div>
                <h3 style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>Key Observations</h3>
                <div style={{ whiteSpace: 'pre-line', color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.8 }}>
                  {report.key_observations}
                </div>
              </div>

              {/* Root Causes */}
              {rootCauses.length > 0 && (
                <>
                  <hr className="divider" />
                  <div>
                    <h3 style={{ fontSize: 14, marginBottom: 10, fontWeight: 600 }}>Root Causes — Ranked by Confidence</h3>
                    {rootCauses.map((rc: any, i) => (
                      <div key={i}
                        className={`root-cause-card ${rc.confidence > 80 ? 'high' : rc.confidence > 60 ? 'medium' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedCause(expandedCause === i ? null : i)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-muted)', minWidth: 22 }}>#{rc.rank}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{rc.cause}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2 }}>Type: {rc.type}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 17, fontWeight: 700, color: rc.confidence > 80 ? 'var(--feuji-red)' : 'var(--feuji-amber)' }}>
                                {rc.confidence}%
                              </div>
                              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
                            </div>
                            {expandedCause === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </div>
                        </div>
                        {expandedCause === i && rc.evidence && (
                          <div style={{
                            marginTop: 9, padding: '7px 11px', background: 'rgba(0,0,0,0.2)',
                            borderRadius: 6, fontSize: 11.5, color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                          }}>
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
                    <h3 style={{ fontSize: 14, marginBottom: 10, fontWeight: 600 }}>Anomaly Timeline — {anomalies.length} detected</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {anomalies.map((a: any, i) => (
                        <div key={i} className={`anomaly-marker ${a.severity === 'WARNING' ? 'warning' : ''}`}>
                          <AlertTriangle size={10} />
                          {a.timestamp_label} — {a.type.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                    {anomalyChartOpts && <ReactECharts option={anomalyChartOpts} style={{ height: 170 }} />}
                  </div>
                </>
              )}

              {/* Correlations */}
              {correlations.length > 0 && (
                <>
                  <hr className="divider" />
                  <div>
                    <h3 style={{ fontSize: 14, marginBottom: 10, fontWeight: 600 }}>Cross-Layer Correlations</h3>
                    {correlations.map((c: any, i) => (
                      <div key={i} style={{
                        padding: '10px 13px', background: 'var(--bg-secondary)',
                        borderRadius: 7, marginBottom: 7, border: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            {c.infra_metric}
                          </span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: Math.abs(c.correlation) > 0.8 ? 'var(--feuji-red)' : 'var(--feuji-amber)' }}>
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

          {/* Technical RCA Tab */}
          {activeTab === 'technical' && (
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--feuji-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} /> Technical Root Cause Analysis
              </h3>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 13.5 }}>
                {report.technical_rca}
              </div>
            </div>
          )}

          {/* Remediation Tab */}
          {activeTab === 'remediation' && (
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={14} /> Remediation Steps
              </h3>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 13.5 }}>
                {report.remediation_steps}
              </div>
            </div>
          )}

          {/* Script Tab */}
          {activeTab === 'script' && scriptResult && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Code size={14} /> Generated {scriptResult.tool?.toUpperCase()} Script
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button 
                    onClick={downloadScript}
                    className="btn btn-secondary" 
                    style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Download size={12} /> Download
                  </button>
                  <span className="badge badge-neutral">{scriptResult.language}</span>
                  <span className="badge badge-warning">{scriptResult.estimated_duration_sec}s duration</span>
                  <span className="badge badge-primary">{scriptResult.peak_vus} peak VUs</span>
                </div>
              </div>
              <MonacoEditor
                height="440px"
                language={scriptResult.language}
                value={scriptResult.script}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, scrollBeyondLastLine: false, lineNumbers: 'on' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
