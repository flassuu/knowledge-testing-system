export default {
  app: {
    name: 'Knowledge Testing',
    tagline: 'Offline classroom testing suite',
  },
  role: {
    student: 'Student',
    teacher: 'Teacher',
    admin: 'Administrator',
  },
  server: {
    checking: 'Checking…',
    online: 'Online',
    offline: 'Offline',
  },
  auth: {
    chooseRole: 'Sign in to your workspace',
    chooseRoleHint: 'Choose how you are signing in — the UI adapts to your role.',
    username: 'Username',
    password: 'Password',
    fullName: 'Full name',
    confirmPassword: 'Confirm password',
    signIn: 'Sign in',
    signOut: 'Sign out',
    register: 'Create account',
    needAccount: 'Student?',
    registerHeading: 'Create a student account',
    registerHint:
      'Your account must be approved by a teacher or administrator before you can sign in.',
    backToLogin: 'Back to sign in',
    pendingTitle: 'Account created',
    pendingNote:
      'Your account awaits approval by a teacher or administrator before you can sign in.',
    form: {
      fullNameRequired: 'Enter your full name',
      usernameTooShort: 'Username must be at least 3 characters',
      passwordMin: 'Password must be at least 8 characters',
      passwordMismatch: 'Passwords do not match',
    },
    errors: {
      invalidCredentials: 'Wrong username or password.',
      pendingApproval: 'Your account awaits approval by a teacher or admin.',
      blocked: 'Your account has been blocked.',
      network: 'Server unreachable. Only cached content is available offline.',
      usernameTaken: 'This username is already taken.',
      validation: 'Please fix the form fields.',
      generic: 'Something went wrong. Please try again.',
    },
  },
  admin: {
    heading: 'Administration',
    subheading: 'Manage accounts: create teachers, approve students, control access.',
    searchPlaceholder: 'Search by name…',
    anyRole: 'Any role',
    anyStatus: 'Any status',
    status: {
      pending: 'Pending',
      approved: 'Approved',
      blocked: 'Blocked',
    },
    refresh: 'Refresh',
    empty: 'No users match these filters.',
    approve: 'Approve',
    block: 'Block',
  },
  teacher: {
    heading: 'Teacher workbench',
    subheading: 'Create tests and courses, run sessions, and review reports.',
    cards: {
      phase: 'Phase {phase}',
      tests: {
        title: 'Test builder',
        description: 'Create and edit tests with five question types.',
      },
      courses: {
        title: 'Courses & materials',
        description: 'Organise classes with materials and assigned tests.',
      },
      sessions: {
        title: 'Live sessions',
        description: 'Start a session — students join by code or QR.',
      },
      reports: {
        title: 'Reports',
        description: 'Grade journals and PDF/CSV export of results.',
      },
    },
  },
  student: {
    heading: 'Student home',
    subheading: 'Join tests, read course materials, and track your results.',
    cards: {
      phase: 'Phase {phase}',
      join: {
        title: 'Join a test',
        description: 'Enter the session code or scan the QR to start.',
      },
      materials: {
        title: 'Course materials',
        description: 'Files and notes attached by your teacher.',
      },
      results: {
        title: 'My results',
        description: 'Your scores and statistics across tests.',
      },
    },
  },
  common: {
    language: 'Language',
    loading: 'Loading…',
  },
  footer: {
    message: 'Runs entirely on the local network — no internet required.',
  },
}