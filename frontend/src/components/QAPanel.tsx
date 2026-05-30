import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { sendChat, retest } from '../api';
import { Send, Bot, RefreshCw, X, MessageSquare, Download, Copy, Check } from 'lucide-react';

export const ChatDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    runId, chatMessages, suggestedQuestions, isChatLoading,
    addChatMessage, setSuggestedQuestions, setChatLoading, report,
  } = useStore();
  const [input, setInput] = useState('');
  const [retesting, setRetesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text || !runId || isChatLoading) return;
    setInput('');
    addChatMessage({ role: 'user', content: text });
    setChatLoading(true);
    try {
      const result = await sendChat(runId, text);
      addChatMessage({
        role: 'assistant',
        content: result.answer,
        suggested_questions: result.suggested_questions,
        retest_suggestion: result.retest_suggestion,
        intent: result.intent,
        action: result.action,
      });
      if (result.suggested_questions) setSuggestedQuestions(result.suggested_questions);
    } catch {
      addChatMessage({ role: 'assistant', content: 'An error occurred. Please try again.' });
    } finally {
      setChatLoading(false);
    }
  };

  const handleRetest = async (scenarioType?: string) => {
    if (!runId) return;
    setRetesting(true);
    try {
      const result = await retest(runId, scenarioType);
      addChatMessage({
        role: 'assistant',
        content: `Retest initiated. New run ID: ${result.run_id}. Redirecting...`,
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      addChatMessage({ role: 'assistant', content: 'Failed to start retest. Please try manually.' });
    } finally {
      setRetesting(false);
    }
  };

  const handleCopyReport = async () => {
    if (!report) return;
    const text = [
      report.executive_summary,
      '\n\nTechnical RCA:',
      report.technical_rca,
      '\n\nRemediation:',
      report.remediation_steps,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    addChatMessage({ role: 'assistant', content: 'Report copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJunit = () => {
    if (!report) return;
    const verdict = report.verdict || {};
    const kpis = report.kpis || {};
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="PerfSight Performance Test" tests="1" failures="${verdict.status === 'FAIL' ? 1 : 0}">
    <testcase name="Performance SLA Check" time="${(kpis.p99_ms || 0) / 1000}">
      ${verdict.status === 'FAIL' ? `<failure message="${verdict.summary}">${verdict.failures?.join(', ')}</failure>` : ''}
    </testcase>
  </testsuite>
</testsuites>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'perfsight-results.xml';
    a.click();
    addChatMessage({ role: 'assistant', content: 'JUnit XML downloaded.' });
  };

  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
  const retestSuggestion = lastAssistantMsg?.retest_suggestion;

  return (
    <div className="chat-drawer">
      {/* Drawer Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ask about your test results</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" style={{ background: 'var(--accent-green)' }} />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 5,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.18s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Export Actions */}
      {report && (
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 6, flexShrink: 0,
        }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleCopyReport}
            style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Report</>}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDownloadJunit}
            style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
          >
            <Download size={12} /> JUnit XML
          </button>
        </div>
      )}

      {/* Welcome State */}
      {chatMessages.length === 0 && (
        <div style={{ padding: '14px 16px', flexShrink: 0 }}>
          <div className="card" style={{
            background: 'rgba(224,64,30,0.05)', borderColor: 'rgba(224,64,30,0.2)',
          }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <MessageSquare size={15} color="var(--feuji-red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  Report is ready for review.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Ask about findings, root causes, remediation steps, or request a retest with different parameters.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {suggestedQuestions.length > 0 && (
        <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Suggested Questions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {suggestedQuestions.slice(0, 4).map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} disabled={isChatLoading}
                style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontFamily: 'inherit',
                  transition: 'all 0.15s', textAlign: 'left',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--feuji-red)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--feuji-red)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="scroll-y" style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
        padding: '12px 14px', overflowY: 'auto',
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <Bot size={11} color="var(--feuji-red)" />
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>PerfSight AI</span>
                {msg.intent && msg.intent !== 'GENERAL' && (
                  <span className={`intent-badge ${msg.intent?.toLowerCase()}`}>{msg.intent}</span>
                )}
              </div>
            )}
            <div className={`chat-bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, maxWidth: '95%' }}>
              {msg.content}
            </div>

            {/* Retest Suggestion */}
            {msg.role === 'assistant' && msg.retest_suggestion?.recommended && (
              <div className="card animate-fade-in" style={{
                marginTop: 7, width: '95%',
                borderColor: 'rgba(224,64,30,0.3)', background: 'rgba(224,64,30,0.05)', padding: '10px 14px',
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: 'var(--feuji-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={13} /> Retest Suggestion
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 10 }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>TYPE</span><br /><strong>{msg.retest_suggestion.suggested_params?.scenario_type}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>USERS</span><br /><strong style={{ color: 'var(--feuji-red)' }}>{msg.retest_suggestion.suggested_params?.peak_vus}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" disabled={retesting}
                    onClick={() => handleRetest(msg.retest_suggestion.suggested_params?.scenario_type)}>
                    {retesting ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Starting...</> : <><RefreshCw size={12} /> Run Retest</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRetest('stress')}>Stress Test</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRetest('soak')}>Soak Test</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isChatLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Bot size={13} color="var(--feuji-red)" />
            <div className="chat-bubble assistant" style={{ padding: '9px 14px' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--feuji-red)',
                    animation: `blink 1s infinite ${d}s`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Ask about results, root causes, or request a retest..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={isChatLoading}
            style={{ fontSize: 13 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={isChatLoading || !input.trim()}
            style={{ flexShrink: 0, padding: '9px 14px' }}
          >
            <Send size={14} />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
          Ask questions · Request retest · Export results
        </p>
      </div>
    </div>
  );
};

// Keep backward-compatible named export
export const QAPanel = ChatDrawer;
