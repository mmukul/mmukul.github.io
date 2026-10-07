export const theme = {
  colors: {
    background: '#070914',
    backgroundTop: '#0E1630',
    surface: '#10162A',
    surfaceAlt: '#15152F',
    surfaceSoft: '#0A1225',
    border: '#2A3858',
    borderSoft: '#25324E',
    borderStrong: '#53658F',
    text: '#F8FAFC',
    textSoft: '#E8F2FF',
    muted: '#AEBBD0',
    muted2: '#8FA1B8',
    accent: '#67E8F9',
    accentText: '#03141F',
    accentAlt: '#A5B4FC',
    success: '#55E6B8',
    warning: '#FCD34D',
    primaryBright: '#06B6D4',
    secondaryBright: '#7C3AED',
    demoStart: '#06B6D4',
    demoMid: '#2563EB',
    demoEnd: '#7C3AED',
  },
} as const

export const buttonStyles = {
  primary: { backgroundColor: theme.colors.primaryBright, borderColor: '#A5F3FC' },
  secondary: { backgroundColor: theme.colors.secondaryBright, borderColor: '#C4B5FD' },
  tertiary: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderStrong },
} as const
