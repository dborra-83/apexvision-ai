/**
 * Store de tema (única fuente de verdad).
 *
 * main.tsx lee el valor inicial del store para aplicar data-theme al arrancar.
 * Este store es el único dueño de:
 * - La lectura/escritura de localStorage('theme')
 * - El atributo data-theme en <html>
 * - La clase .theme-transition durante el switch
 */

import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function withTransition(callback: () => void) {
  document.body.classList.add('theme-transition');
  callback();
  // Remover la clase tras completar la transición
  const timer = setTimeout(() => {
    document.body.classList.remove('theme-transition');
  }, 350);
  return timer;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'dark',

  toggle: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      withTransition(() => applyTheme(next));
      return { theme: next };
    }),

  setTheme: (t) => {
    withTransition(() => applyTheme(t));
    set({ theme: t });
  },
}));
