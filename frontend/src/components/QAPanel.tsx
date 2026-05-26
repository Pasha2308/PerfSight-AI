import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { sendChat, retest } from '../api';
import { Send, Bot, RefreshCw, MessageSquare, Sparkles } from 'lucide-react';

export const QAPanel: React.FC = () => {
  const { runId, chatMessages, suggestedQuestions, isChatLoading, addChatMessage, setSuggestedQuestions, setChatLoading, report } = useStore();
  const [input, setInput] = useState('');
  const [retesting, setRetesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      addChatMessage({ role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' });
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
        content: `🔄 Retest initiated! New run ID: \`${result.run_id}\`. Redirecting you to the new test...`,
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      addChatMessage({ role: 'assistant', content: 'Failed to start retest. Please try manually.' });
    } finally {
      setRetesting(false);
    }
  };

  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
  const retestSuggestion = lastAssistantMsg?.retest_suggestion;

  const handleExport = async (format: string) => {
    const reportData = report;
    if (!reportData) return;
    if (format === 'copy') {
      const text = [
        reportData.executive_summary,
        '\n\nTechnical RCA:',
        reportData.technical_rca,
        '\n\nRemediation:',
        reportData.remediation_steps,
      ].join('\n');
      navigator.clipboard.writeText(text);
      addChatMessage({ role: 'assistant', content: '✅ Report copied to clipboard!' });
    } else if (format === 'junit') {
      const verdict = reportData.verdict || {};
      const kpis = reportData.kpis || {};
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="PerfSight Performance Test" tests="1" failures="${verdict.status === 'FAIL' ? 1 : 0}">
    <testcase name="Performance SLA Check" time="${(kpis.p99_ms || 0) / 1000}">
      ${verdict.status === 'FAIL' ? `<failure message="${verdict.summary}">${verdict.failures?.join(', ')}</failure>` : ''}
    </testcase>
  </testsuite>
</testsuites>`;
      const blob = new Blob([xml], { type: 'application/xml' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'perfsight-results.xml'; a.click();
      addChatMessage({ role: 'assistant', content: '✅ JUnit XML downloaded!' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>QA Agent — Human Review</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ask questions, request refinements, or trigger a retest</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="live-dot" style={{ background: 'var(--accent-purple)' }} />
          <span style={{ fontSize: 12, color: 'var(--accent-purple)' }}>READY</span>
        </div>
      </div>

      {/* Welcome message if no chat */}
      {chatMessages.length === 0 && (
        <div className="card animate-fade-in" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.3)', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Sparkles size={18} color="var(--accent-purple)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>
                The report is ready for your review. 🎉
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                I can answer questions about the findings, explain any anomaly in detail, suggest what to fix first, 
                or recommend a retest with different parameters. What would you like to explore?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Questions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestedQuestions.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} disabled={isChatLoading}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent-purple)'; (e.target as HTMLElement).style.color = 'var(--accent-purple)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4, minHeight: 200, maxHeight: 420 }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Bot size={12} color="var(--accent-purple)" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>PerfSight AI</span>
                {msg.intent && msg.intent !== 'GENERAL' && (
                  <span className={`intent-badge ${msg.intent?.toLowerCase()}`}>
                    {msg.intent === 'RETEST' ? '🔄' : msg.intent === 'REFORMAT' ? '✏️' : msg.intent === 'EXPORT' ? '📤' : msg.intent === 'RECOMMEND' ? '💡' : '🔍'} {msg.intent}
                  </span>
                )}
              </div>
            )}
            <div className={`chat-bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {msg.content}
            </div>
            {/* Retest suggestion card */}
            {msg.role === 'assistant' && msg.retest_suggestion?.recommended && (
              <div className="card animate-fade-in" style={{ marginTop: 8, maxWidth: '85%', borderColor: 'rgba(88,166,255,0.3)', background: 'var(--glow-blue)', padding: '12px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--accent-blue)' }}>
                  🔄 Retest Configured
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>TYPE</span><br /><strong>{msg.retest_suggestion.suggested_params?.scenario_type}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>USERS</span><br /><strong style={{ color: 'var(--accent-blue)' }}>{msg.retest_suggestion.suggested_params?.peak_vus}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" disabled={retesting}
                    onClick={() => handleRetest(msg.retest_suggestion.suggested_params?.scenario_type)}>
                    {retesting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Starting...</> : <><RefreshCw size={14} /> Run Retest</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRetest('stress')}>Try Stress Test</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRetest('soak')}>Try Soak Test</button>
                </div>
              </div>
            )}
            {/* Export action card */}
            {msg.role === 'assistant' && (msg as any).action === 'export' && (
              <div className="card animate-fade-in" style={{ marginTop: 8, maxWidth: '85%', borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.05)', padding: '12px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--accent-purple)' }}>
                  📤 Export Report
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleExport('copy')}>📋 Copy to Clipboard</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleExport('junit')}>⚙️ Download JUnit XML</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isChatLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Bot size={14} color="var(--accent-purple)" />
            <div className="chat-bubble assistant" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)', animation: 'blink 1s infinite 0s' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)', animation: 'blink 1s infinite 0.2s' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)', animation: 'blink 1s infinite 0.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          className="input"
          placeholder="Ask anything, e.g. 'Why was checkout slow?' or 'Redo with 2000 users' or 'Give me an executive summary'..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={isChatLoading}
        />
        <button className="btn btn-primary" onClick={() => sendMessage()} disabled={isChatLoading || !input.trim()}
          style={{ flexShrink: 0, padding: '10px 16px' }}>
          <Send size={16} />
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        Ask questions · Request retest · Reformat report · Export results
      </p>
    </div>
  );
};
