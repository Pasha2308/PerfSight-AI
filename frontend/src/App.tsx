import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import { NLTestWizard } from './components/NLTestWizard';
import { LiveMonitor } from './components/LiveMonitor';
import { ReportView } from './components/ReportView';
import { ChatDrawer } from './components/QAPanel';
import { ToolsPanel } from './components/ToolsPanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Auth } from './components/Auth';
import { setAuthToken } from './api';
import { CICDPanel } from './components/Integrations/CICDPanel';
import { ObservabilityPanel } from './components/Integrations/ObservabilityPanel';
import {
  CheckCircle, Clock, AlertCircle, ChevronRight,
  Activity, Wrench, Zap, BarChart2, Radio,
  MessageSquare, ChevronLeft, Settings, LogOut, GitPullRequest
} from 'lucide-react';

const PHASE_ORDER = ['scenario', 'scripting', 'executing', 'analyzing', 'reporting', 'qa_ready'];

const PHASE_LABELS: Record<string, string> = {
  scenario: 'Scenario Analysis',
  scripting: 'Script Generation',
  executing: 'Test Execution',
  analyzing: 'ML Analysis',
  reporting: 'Report Generation',
  qa_ready: 'AI Assistant Ready',
};

function PipelineSidebar() {
  const { phases } = useStore();
  return (
    <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 10, padding: '0 4px', fontWeight: 600,
      }}>
        Agent Pipeline
      </div>
      {PHASE_ORDER.map((key, idx) => {
        const phase = phases[key];
        if (!phase) return null;
        return (
          <div key={key} className={`phase-step ${phase.status}`}>
            <div className={`phase-icon ${phase.status}`}>
              {phase.status === 'done'
                ? <CheckCircle size={14} />
                : phase.status === 'running'
                ? <div className="spinner" style={{ width: 15, height: 15 }} />
                : phase.status === 'error'
                ? <AlertCircle size={14} />
                : <Clock size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: phase.status === 'running' ? 'var(--feuji-red)' : phase.status === 'done' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {PHASE_LABELS[key] || key}
              </div>
              {phase.message && phase.status === 'running' && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {phase.message.replace(/[^\x00-\x7F]/g, '').trim()}
                </div>
              )}
            </div>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            }}>
              {idx + 1}
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
    <div className="card animate-fade-in" style={{ marginBottom: 14, padding: '14px 18px', borderColor: 'rgba(224,64,30,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {scenario.nl_description && (
            <div style={{
              marginBottom: 10, padding: '8px 12px', borderRadius: 7,
              background: 'rgba(224, 64, 30, 0.04)', border: '1px solid rgba(224, 64, 30, 0.15)',
              fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, fontStyle: 'italic',
            }}>
              <span style={{ color: 'var(--feuji-red)', fontStyle: 'normal', fontWeight: 600, marginRight: 6 }}>Scenario:</span>
              "{scenario.nl_description}"
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="badge badge-primary">{scenario.app_type}</span>
            <span className="badge badge-neutral">{scenario.scenario_name}</span>
            <span className="badge badge-neutral">{scenario.target_url}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {scenario.inferred_endpoints?.slice(0, 5).map((ep: any, i: number) => (
              <span key={i} className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                {ep.method} {ep.path}
              </span>
            ))}
            {scenario.inferred_endpoints?.length > 5 && (
              <span className="badge badge-neutral">+{scenario.inferred_endpoints.length - 5} more</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Peak VUs</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--feuji-red)', lineHeight: 1 }}>
            {scenario.load_parameters?.peak_vus}
          </div>
        </div>
      </div>
      {scenario.risk_areas?.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--feuji-amber)' }}>
          <AlertCircle size={12} />
          Risk areas: {scenario.risk_areas.slice(0, 2).join(' · ')}
        </div>
      )}
    </div>
  );
}

function LandingPage() {
  const [activeTab, setActiveTab] = useState<'test' | 'tools' | 'integrations'>('test');

  const STEPS = [
    { icon: <MessageSquare size={16} />, label: 'Describe Scenario' },
    { icon: <Zap size={16} />, label: 'AI Parsing' },
    { icon: <Activity size={16} />, label: 'Script Generation' },
    { icon: <Radio size={16} />, label: 'Test Execution' },
    { icon: <BarChart2 size={16} />, label: 'ML Analysis' },
    { icon: <CheckCircle size={16} />, label: 'Report + Chat' },
  ];

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 36, padding: '16px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px',
          borderRadius: 20, background: 'rgba(224, 64, 30, 0.06)',
          border: '1px solid rgba(224, 64, 30, 0.18)', fontSize: 11.5,
          color: 'var(--feuji-red)', marginBottom: 18, fontWeight: 500,
        }}>
          <div className="live-dot" style={{ width: 6, height: 6, background: 'var(--feuji-red)' }} />
          AI-Powered · Autonomous Analysis · Multi-LLM
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }}>
          Describe Your Scenario.{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AI handles the heavy lifting.
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
          Type any real-world scenario in plain English — flash sales, API stress tests, event launches.
          AI generates the script, runs the test, detects anomalies, and delivers a full diagnostic report.
        </p>
      </div>

      {/* Pipeline Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        {STEPS.map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12, gap: 6,
              color: 'var(--text-secondary)',
            }}>
              <div style={{ color: i === 0 ? 'var(--feuji-red)' : 'var(--feuji-amber)', opacity: i === 0 ? 1 : 0.8 }}>
                {step.icon}
              </div>
              {step.label}
            </div>
            {i < arr.length - 1 && <ChevronRight size={13} color="var(--text-muted)" />}
          </React.Fragment>
        ))}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, justifyContent: 'center' }}>
        {[
          { key: 'test' as const, icon: <Zap size={14} />, label: 'New Performance Test' },
          { key: 'tools' as const, icon: <Wrench size={14} />, label: 'JMeter Tools & Import' },
          { key: 'integrations' as const, icon: <GitPullRequest size={14} />, label: 'CI/CD & Integrations' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '9px 22px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.18s',
              background: activeTab === t.key
                ? 'linear-gradient(135deg, rgba(224,64,30,0.12), rgba(242,141,29,0.08))'
                : 'var(--bg-card)',
              border: `1px solid ${activeTab === t.key ? 'var(--feuji-red)' : 'var(--border)'}`,
              color: activeTab === t.key ? 'var(--feuji-red)' : 'var(--text-secondary)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card" style={{ padding: 24, animation: 'fade-in 0.3s ease' }}>
        {activeTab === 'test' && <NLTestWizard />}
        {activeTab === 'tools' && <ToolsPanel />}
        {activeTab === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            <ObservabilityPanel />
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
            <CICDPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { currentPhase, report, runId, reset } = useStore();
  const [mainTab, setMainTab] = useState<'monitor' | 'report'>('monitor');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('perfsight_token'));
  const [userName, setUserName] = useState<string | null>(localStorage.getItem('perfsight_user_name'));

  const handleLogin = (newToken: string, userId: string, name: string) => {
    localStorage.setItem('perfsight_token', newToken);
    localStorage.setItem('perfsight_user_name', name);
    setToken(newToken);
    setUserName(name);
    setAuthToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('perfsight_token');
    localStorage.removeItem('perfsight_user_name');
    setToken(null);
    setUserName(null);
    setAuthToken(null);
    reset();
  };

  // Initialize API token on load
  useEffect(() => {
    if (token) setAuthToken(token);
  }, []);

  const isIdle = currentPhase === 'idle';
  const hasReport = !!report;
  const isQAReady = currentPhase === 'qa_ready' || hasReport;

  useEffect(() => {
    if (currentPhase === 'executing' || currentPhase === 'analyzing') setMainTab('monitor');
    if (currentPhase === 'reporting' || currentPhase === 'qa_ready') {
      setMainTab('report');
      setTimeout(() => setChatOpen(true), 600);
    }
  }, [currentPhase]);

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Feuji Logo Mark */}
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(224, 64, 30, 0.35)',
            flexShrink: 0,
          }}>
            <BarChart2 size={18} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>PerfSight</span>
              <span style={{
                fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>AI</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              Performance Testing Intelligence
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {runId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} color="var(--accent-green)" />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {runId.slice(0, 8)}
              </span>
            </div>
          )}
          {!isIdle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {userName ? `Hi, ${userName}` : 'Workspace'}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSettingsOpen(true)}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Settings size={16} /> <span style={{ marginLeft: 4 }}>Settings</span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '22px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {isIdle ? (
          <LandingPage />
        ) : (
          <div style={{ display: 'flex', gap: 18 }}>
            {/* Sidebar */}
            <PipelineSidebar />

            {/* Main Panel */}
            <div style={{ flex: 1, minWidth: 0, marginRight: chatOpen ? 380 : 0, transition: 'margin-right 0.25s ease' }}>
              <ScenarioCard />

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                {[
                  { key: 'monitor' as const, icon: <Radio size={13} />, label: 'Live Monitor', show: true },
                  { key: 'report' as const, icon: <BarChart2 size={13} />, label: 'Report', show: hasReport },
                ].filter(t => t.show).map(t => (
                  <button key={t.key} onClick={() => setMainTab(t.key)}
                    style={{
                      padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                      background: mainTab === t.key ? 'rgba(224, 64, 30, 0.08)' : 'var(--bg-card)',
                      border: `1px solid ${mainTab === t.key ? 'var(--feuji-red)' : 'var(--border)'}`,
                      color: mainTab === t.key ? 'var(--feuji-red)' : 'var(--text-secondary)',
                      transition: 'all 0.18s',
                    }}>
                    {t.icon} {t.label}
                    {t.key === 'report' && hasReport && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', animation: 'blink 1.4s infinite' }} />
                    )}
                  </button>
                ))}
              </div>

              {mainTab === 'monitor' && <LiveMonitor />}
              {mainTab === 'report' && hasReport && <ReportView />}
            </div>
          </div>
        )}
      </main>

      {/* ── Chat Drawer Toggle Button ── */}
      {isQAReady && !isIdle && (
        <button
          className="chat-drawer-toggle"
          onClick={() => setChatOpen(v => !v)}
          title={chatOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
          style={{ top: chatOpen ? '50%' : '50%' }}
        >
          {chatOpen
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />}
        </button>
      )}

      {/* ── Chat Drawer ── */}
      {isQAReady && chatOpen && !isIdle && (
        <ChatDrawer onClose={() => setChatOpen(false)} />
      )}

      {/* ── Settings Drawer ── */}
      {settingsOpen && (
        <SettingsDrawer onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
