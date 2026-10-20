/**
 * ThermoOlyMaster - Visual Theme Manager
 * Provides 5 curated theme options:
 * 1. thermal   - Thermal Obsidian (Default fiery infrared & cyan)
 * 2. cryo      - Cryo Arctic (Cool, calm glacier blues, reduced contrast)
 * 3. academic  - Academic Slate (Muted indigo, balanced contrast)
 * 4. forest    - Emerald Lab (Deep spruce & soothing mint)
 * 5. daylight  - Daylight Classroom (High-readability light mode)
 */

export const THEMES = [
  { id: 'thermal', name: 'Thermal', title: 'Thermal Obsidian', icon: '🔥', desc: 'Fiery infrared & cyan lab (Default)' },
  { id: 'cryo', name: 'Cryo', title: 'Cryo Arctic', icon: '🧊', desc: 'Glacier blues & calm slate (Less contrast)' },
  { id: 'academic', name: 'Academic', title: 'Academic Slate', icon: '🎓', desc: 'Muted indigo & low eye-strain' },
  { id: 'forest', name: 'Emerald', title: 'Emerald Lab', icon: '🌿', desc: 'Deep spruce & soothing mint' },
  { id: 'daylight', name: 'Daylight', title: 'Daylight Classroom', icon: '☀️', desc: 'Clean, high-readability light mode' }
];

export class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'thermo_theme_v1';
    this.currentTheme = this.getSavedTheme();
  }

  getSavedTheme() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || 'thermal';
    } catch {
      return 'thermal';
    }
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  getThemeInfo(id = this.currentTheme) {
    return THEMES.find(t => t.id === id) || THEMES[0];
  }

  setTheme(themeId) {
    const valid = THEMES.some(t => t.id === themeId);
    const selected = valid ? themeId : 'thermal';
    this.currentTheme = selected;

    document.documentElement.setAttribute('data-theme', selected);
    try {
      localStorage.setItem(this.STORAGE_KEY, selected);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }

    this.updateUI();
    window.dispatchEvent(new CustomEvent('thermo_theme_changed', { 
      detail: { theme: selected, info: this.getThemeInfo(selected) } 
    }));
    return selected;
  }

  init() {
    // Apply initial saved theme
    this.setTheme(this.currentTheme);
    this.bindEvents();
  }

  bindEvents() {
    const btnToggle = document.getElementById('btnThemeToggle');
    const menu = document.getElementById('themeDropdownMenu');

    if (btnToggle && menu) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'flex';
        menu.style.display = isOpen ? 'none' : 'flex';
        btnToggle.setAttribute('aria-expanded', !isOpen);
      });

      // Close when clicking outside
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btnToggle.contains(e.target)) {
          menu.style.display = 'none';
          btnToggle.setAttribute('aria-expanded', 'false');
        }
      });

      // Option clicks
      menu.querySelectorAll('.theme-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          if (theme) {
            this.setTheme(theme);
            menu.style.display = 'none';
            btnToggle.setAttribute('aria-expanded', 'false');
            const info = this.getThemeInfo(theme);
            if (window.showToast) {
              window.showToast(`Switched visual theme to ${info.title} ${info.icon}`, 'info');
            }
          }
        });
      });
    }
  }

  updateUI() {
    const info = this.getThemeInfo();
    const iconEl = document.getElementById('currentThemeIcon');
    const nameEl = document.getElementById('currentThemeName');

    if (iconEl) iconEl.textContent = info.icon;
    if (nameEl) nameEl.textContent = info.name;

    const menu = document.getElementById('themeDropdownMenu');
    if (menu) {
      menu.querySelectorAll('.theme-option-btn').forEach(btn => {
        if (btn.dataset.theme === this.currentTheme) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }
}

export const themeManager = new ThemeManager();
