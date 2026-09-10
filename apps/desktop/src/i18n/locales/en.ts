export default {
  app: {
    name: 'Knowledge Testing — Teacher',
  },
  home: {
    title: 'Teacher application',
    scaffoldNote:
      'Baseline scaffold: this screen proves the Tauri ↔ Rust bridge and API connectivity.',
    rustBridge: {
      label: 'Rust bridge demo',
      description: 'Calls a native Rust command through the Tauri `invoke` bridge.',
      placeholder: 'Enter a name…',
      button: 'Greet',
      result: 'Rust says: {message}',
    },
    server: {
      label: 'Local server',
      checking: 'Checking…',
      online: 'Online',
      offline: 'Offline',
    },
    nextPhase:
      'Next phase: test builder UI, session management, and live results board.',
  },
  common: {
    language: 'Language',
  },
}