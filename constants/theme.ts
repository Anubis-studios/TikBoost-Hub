// TikBoost Design System
export const Colors = {
  // Base
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#222222',
  surfaceBorder: '#2A2A2A',

  // Brand
  primary: '#FF2D55',
  primaryLight: '#FF6B81',
  primaryDark: '#CC0033',
  primaryGlow: 'rgba(255, 45, 85, 0.15)',

  // Accent
  gold: '#FFD700',
  goldLight: '#FFE55C',
  purple: '#8B5CF6',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#555555',
  textInverse: '#0D0D0D',

  // Semantic
  success: '#00D97E',
  warning: '#FFB830',
  error: '#FF453A',
  info: '#0A84FF',

  // Gradients (expressed as arrays for LinearGradient)
  gradientPink: ['#FF2D55', '#FF6B81'],
  gradientPinkDark: ['#CC0033', '#FF2D55'],
  gradientGold: ['#FFD700', '#FFA500'],
  gradientDark: ['#1A1A1A', '#0D0D0D'],
  gradientCard: ['#2A1020', '#1A1A1A'],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  pink: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  gold: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
