// Stage Core cloud stub — runs in guest mode (no Firebase needed)
// All functions are no-ops that keep the app running locally.

window.SC = {
  isReady:              () => false,
  getUser:              () => null,
  listenAuth:           (cb) => { setTimeout(() => cb(null), 0); return () => {}; },
  signUp:               async () => { throw new Error('Cloud not configured'); },
  signIn:               async () => { throw new Error('Cloud not configured'); },
  signInWithGoogle:     async () => { throw new Error('Cloud not configured'); },
  logOut:               async () => {},
  resendVerificationEmail: async () => {},
  updateDisplayName:    async () => {},
  disableAccount:       async () => {},
  deleteAccount:        async () => {},
  checkAccountDisabled: async () => false,
  isTotpEnrolled:       () => false,
  generateTotpSecret:   async () => { throw new Error('Cloud not configured'); },
  enrollTotp:           async () => { throw new Error('Cloud not configured'); },
  unenrollTotp:         async () => {},
  getMfaResolver:       () => null,
  resolveSignInMfa:     async () => { throw new Error('Cloud not configured'); },
  cloudSave:            async () => {},
  cloudAutoSave:        async () => {},
  cloudListProjects:    async () => [],
  cloudLoadProject:     async () => null,
  cloudLoadAutoSave:    async () => null,
  cloudDeleteProject:   async () => {},
};

// Auto-bypass the sign-in gate — running in local guest mode
localStorage.setItem('sc_welcomed', '1');

setTimeout(() => {
  if (typeof window.onSCAuthChange === 'function') {
    window.onSCAuthChange(null);
  }
}, 0);
