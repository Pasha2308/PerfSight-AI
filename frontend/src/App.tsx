import React, { useState } from 'react';
import { useStore } from './store';
import { NLTestWizard } from './components/NLTestWizard';
import { LiveMonitor } from './components/LiveMonitor';
import { ReportView } from './components/ReportView';
import { QAPanel } from './components/QAPanel';
import { Zap, CheckCircle, Clock, AlertCircle, ChevronRight, Activity } from 'lucide-react';

const PHASE_ORDER = ['scenario', 'scripting', 'executing', 'analyzing', 'reporting', 'qa_ready'];

function PipelineSidebar() {
  const { phases, currentPhase } = useStore();

  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '0 4px' }}>
        Agent Pipeline
      </div>
      {PHASE_ORDER.map(key => {
        const phase = phases[key];
        if (!phase) return null;
        return (
          <div key={key} className={`phase-step ${phase.status}`}>
            <div className={`phase-icon ${phase.status}`}>
              {phase.status === 'done' ? <CheckCircle size={15} />
               : phase.status === 'running' ? <div className="spinner" style={{ width: 16, height: 16 }} />
               : phase.status === 'error' ? <AlertCircle size={15} />
               : <Clock size={15} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{phase.label}</div>
              {phase.message && phase.status === 'running' && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{phase.message}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScenarioCard() {
  const { scenario } = useStore();
  if (!scenario) return null;

  return (
    <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
      {/* NL description banner */}
      {scenario.nl_description && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.08))',
          border: '1px solid rgba(124,58,237,0.25)',
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          <span style={{ color: 'var(--accent-purple)', fontStyle: 'normal', fontWeight: 600 }}>💬 Scenario: </span>
          "{scenario.nl_description}"
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="badge badge-purple">{scenario.app_type}</span>
            <span className="badge badge-info">{scenario.scenario_name}</span>
          </div>
          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>{scenario.target_url}</h3>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PEAK VUs</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{scenario.load_parameters?.peak_vus}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {scenario.inferred_endpoints?.slice(0, 6).map((ep: any, i: number) => (
          <span key={i} className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {ep.method} {ep.path}
          </span>
        ))}
        {scenario.inferred_endpoints?.length > 6 && (
          <span className="badge badge-info">+{scenario.inferred_endpoints.length - 6} more</span>
        )}
      </div>
      {scenario.risk_areas?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--accent-yellow)', marginBottom: 4 }}>
          ⚠ Risk areas: {scenario.risk_areas.slice(0, 2).join(' · ')}
        </div>
      )}
      {scenario.known_failure_modes?.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          🔍 Known failure modes: {scenario.known_failure_modes.slice(0, 3).join(', ')}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { currentPhase, report, runId, reset } = useStore();
  const [mainTab, setMainTab] = useState<'monitor' | 'report' | 'qa'>('monitor');

  const isIdle = currentPhase === 'idle';
  const hasReport = !!report;
  const isQAReady = currentPhase === 'qa_ready' || hasReport;

  // Auto-switch tabs
  React.useEffect(() => {
    if (currentPhase === 'executing' || currentPhase === 'analyzing') setMainTab('monitor');
    if (currentPhase === 'reporting' || currentPhase === 'qa_ready') setMainTab('report');
  }, [currentPhase]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px rgba(37, 99, 235, 0.4)',
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>PerfSight</span>
            <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: 16 }}> AI</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>Autonomous Performance Intelligence</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {runId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} color="var(--accent-green)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {runId.slice(0, 8)}...
              </span>
            </div>
          )}
          {!isIdle && (
            <button className="btn btn-ghost btn-sm" onClick={reset}>New Test</button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {isIdle ? (
          // Landing / New Test
          <div>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 40, padding: '20px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', fontSize: 12, color: 'var(--accent-blue)', marginBottom: 16 }}>
                <div className="live-dot" style={{ width: 6, height: 6 }} /> AI-Powered · Zero Config · Autonomous
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }}>
                Describe Your Scenario.{' '}
                <span style={{ background: 'linear-gradient(135deg, #58a6ff, #bc8cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AI Does the Rest.
                </span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
                Type any real-world scenario in plain English — flash sales, event launches, API stress tests.
                AI generates the script, runs the test, detects anomalies, and gives you a full report to chat with.
              </p>
            </div>

            {/* How it works */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
              {[
                { icon: '💬', label: 'Describe Scenario' },
                { icon: '🧠', label: 'AI Parsing (SETI)' },
                { icon: '✍️', label: 'Script Generation' },
                { icon: '🚀', label: 'Real Execution' },
                { icon: '📊', label: 'ML Analysis' },
                { icon: '📝', label: 'Chat + Report' },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{step.icon}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{step.label}</div>
                  </div>
                  {i < arr.length - 1 && <ChevronRight size={14} color="var(--text-muted)" />}
                </React.Fragment>
              ))}
            </div>

            <NLTestWizard />
          </div>
        ) : (
          // Active Test View
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Sidebar */}
            <PipelineSidebar />

            {/* Main panel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ScenarioCard />

              {/* Main tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {[
                  { key: 'monitor', label: '📡 Live Monitor', show: true },
                  { key: 'report', label: '📋 Report', show: hasReport },
                  { key: 'qa', label: '💬 QA Agent', show: isQAReady },
                ].filter(t => t.show).map(t => (
                  <button key={t.key} onClick={() => setMainTab(t.key as any)}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      background: mainTab === t.key ? 'rgba(88,166,255,0.12)' : 'var(--bg-card)',
                      border: `1px solid ${mainTab === t.key ? 'var(--accent-blue)' : 'var(--border)'}`,
                      color: mainTab === t.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}>
                    {t.label}
                    {t.key === 'qa' && isQAReady && (
                      <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', animation: 'blink 1.2s infinite', verticalAlign: 'middle' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {mainTab === 'monitor' && <LiveMonitor />}
              {mainTab === 'report' && hasReport && <ReportView />}
              {mainTab === 'qa' && isQAReady && (
                <div style={{ display: 'grid', gridTemplateColumns: hasReport ? '1fr 420px' : '1fr', gap: 16 }}>
                  {hasReport && (
                    <div>
                      <ReportView />
                    </div>
                  )}
                  <div className="card" style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
                    <QAPanel />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
