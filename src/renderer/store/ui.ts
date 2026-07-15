import { create } from 'zustand';

export interface TerminalLog {
  commandId: string;
  command: string;
  output: string;
  status: 'running' | 'completed';
  timestamp: number;
}

export type Panel =
  | 'branches'
  | 'git-add'
  | 'diff'
  | 'commit'
  | 'log'
  | 'push'
  | 'stash'
  | 'cherry-pick'
  | 'remotes'
  | 'settings'
  | 'pull'
  | 'grep'
  | 'odoo';

export type LogTab = 'local' | 'ahead' | 'compare';
export type DiffTab = 'smart' | 'working';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ModalConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: (value?: string, checkboxChecked?: boolean) => void;
  onCancel?: () => void;
  inputPlaceholder?: string;
  requireInput?: string;
  showTextInput?: boolean;
  initialInputValue?: string;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  checkboxDefaultChecked?: boolean;
}

interface UIStore {
  activePanel: Panel;
  setActivePanel: (panel: Panel) => void;
  activeLogTab: LogTab;
  setActiveLogTab: (tab: LogTab) => void;
  activeDiffTab: DiffTab;
  setActiveDiffTab: (tab: DiffTab) => void;
  selectedDiffFile: string | null;
  setSelectedDiffFile: (file: string | null) => void;
  diffViewMode: 'unified' | 'split';
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  modal: ModalConfig | null;
  showModal: (config: ModalConfig) => void;
  closeModal: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  terminalOpen: boolean;
  toggleTerminal: () => void;
  terminalLogs: TerminalLog[];
  clearTerminalLogs: () => void;
  addTerminalLog: (log: Omit<TerminalLog, 'output' | 'status'>) => void;
  appendTerminalOutput: (commandId: string, output: string) => void;
  endTerminalLog: (commandId: string) => void;
  themeIndex: number;
  setThemeIndex: (index: number) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>((set) => ({
  activePanel: 'branches',
  setActivePanel: (panel) => set({ activePanel: panel }),

  activeLogTab: 'local',
  setActiveLogTab: (tab) => set({ activeLogTab: tab }),

  activeDiffTab: 'smart',
  setActiveDiffTab: (tab) => set({ activeDiffTab: tab }),

  selectedDiffFile: null,
  setSelectedDiffFile: (file) => set({ selectedDiffFile: file }),

  diffViewMode: 'unified',
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),

  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.duration || 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  modal: null,
  showModal: (config) => set({ modal: config }),
  closeModal: () => set({ modal: null }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  terminalOpen: false,
  toggleTerminal: () => set((state) => ({ terminalOpen: !state.terminalOpen })),
  terminalLogs: [],
  clearTerminalLogs: () => set({ terminalLogs: [] }),
  addTerminalLog: (log) =>
    set((state) => ({
      terminalLogs: [
        ...state.terminalLogs,
        { ...log, output: '', status: 'running' as const }
      ].slice(-100)
    })),
  appendTerminalOutput: (commandId, output) =>
    set((state) => ({
      terminalLogs: state.terminalLogs.map((log) => {
        if (log.commandId === commandId) {
          let newOutput = log.output + output;
          if (newOutput.length > 25000) {
            newOutput = newOutput.slice(0, 25000) + '\n... [output truncated for performance]';
          }
          return { ...log, output: newOutput };
        }
        return log;
      })
    })),
  endTerminalLog: (commandId) =>
    set((state) => ({
      terminalLogs: state.terminalLogs.map((log) =>
        log.commandId === commandId
          ? { ...log, status: 'completed' as const }
          : log
      )
    })),
  themeIndex: parseInt(localStorage.getItem('odoogit_themeIndex') || '0', 10),
  setThemeIndex: (index) => {
    localStorage.setItem('odoogit_themeIndex', index.toString());
    set({ themeIndex: index });
  },
}));
