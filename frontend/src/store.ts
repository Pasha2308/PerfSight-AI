import { create } from 'zustand';

export type Phase = 'idle' | 'scenario' | 'scripting' | 'executing' | 'analyzing' | 'reporting' | 'qa_ready' | 'error';

export interface PipelinePhase {
  name: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
  data?: any;
}

export interface Metric {
  timestamp: number;
  endpoint: string;
  response_time: number;
  status_code: number;
  vus: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  suggested_questions?: string[];
  retest_suggestion?: any;
  intent?: string;
  action?: string;  // 'retest' | 'export' | etc.
}

interface AppState {
  // Current run
  runId: string | null;
  currentPhase: Phase;
  phases: Record<string, PipelinePhase>;
  liveMetrics: Metric[];
  liveInfra: any[];
  liveVUs: number;
  liveProgress: number;
  scenario: any;
  scriptResult: any;
  findings: any;
  report: any;
  chatMessages: ChatMessage[];
  suggestedQuestions: string[];
  isChatLoading: boolean;
  ws: WebSocket | null;

  // History
  testRuns: any[];

  // Actions
  setRunId: (id: string) => void;
  setPhase: (phase: string, status: string, message?: string, data?: any) => void;
  addMetrics: (metrics: Metric[], infra?: any, vus?: number, progress?: number) => void;
  setScenario: (s: any) => void;
  setScriptResult: (s: any) => void;
  setFindings: (f: any) => void;
  setReport: (r: any) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setSuggestedQuestions: (q: string[]) => void;
  setChatLoading: (v: boolean) => void;
  setWs: (ws: WebSocket | null) => void;
  setTestRuns: (runs: any[]) => void;
  reset: () => void;
}

const PHASES_INIT: Record<string, PipelinePhase> = {
  scenario:  { name: 'scenario',  label: 'Scenario Analysis',   status: 'pending' },
  scripting: { name: 'scripting', label: 'Script Generation',   status: 'pending' },
  executing: { name: 'executing', label: 'Test Execution',       status: 'pending' },
  analyzing: { name: 'analyzing', label: 'AI Analysis',          status: 'pending' },
  reporting: { name: 'reporting', label: 'Report Generation',    status: 'pending' },
  qa_ready:  { name: 'qa_ready',  label: 'AI Assistant Ready',   status: 'pending' },
};

export const useStore = create<AppState>((set, get) => ({
  runId: null,
  currentPhase: 'idle',
  phases: { ...PHASES_INIT },
  liveMetrics: [],
  liveInfra: [],
  liveVUs: 0,
  liveProgress: 0,
  scenario: null,
  scriptResult: null,
  findings: null,
  report: null,
  chatMessages: [],
  suggestedQuestions: [],
  isChatLoading: false,
  ws: null,
  testRuns: [],

  setRunId: (id) => set({ runId: id }),

  setPhase: (phase, status, message, data) => set(s => ({
    currentPhase: phase as Phase,
    phases: {
      ...s.phases,
      [phase]: { ...s.phases[phase], status: status as any, message, data },
    },
  })),

  addMetrics: (metrics, infra, vus, progress) => set(s => ({
    liveMetrics: [...s.liveMetrics, ...metrics].slice(-2000),
    liveInfra: infra ? [...s.liveInfra, infra].slice(-500) : s.liveInfra,
    liveVUs: vus ?? s.liveVUs,
    liveProgress: progress ?? s.liveProgress,
  })),

  setScenario: (scenario) => set({ scenario }),
  setScriptResult: (scriptResult) => set({ scriptResult }),
  setFindings: (findings) => set({ findings }),
  setReport: (report) => set({ report }),

  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),

  setSuggestedQuestions: (suggestedQuestions) => set({ suggestedQuestions }),

  setChatLoading: (isChatLoading) => set({ isChatLoading }),

  setWs: (ws) => set({ ws }),

  setTestRuns: (testRuns) => set({ testRuns }),

  reset: () => set({
    runId: null, currentPhase: 'idle',
    phases: { ...PHASES_INIT },
    liveMetrics: [], liveInfra: [], liveVUs: 0, liveProgress: 0,
    scenario: null, scriptResult: null, findings: null, report: null,
    chatMessages: [], suggestedQuestions: [], isChatLoading: false, ws: null,
  }),
}));
