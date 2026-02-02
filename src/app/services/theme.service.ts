import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    currentTheme = signal<string>('dark'); // Changed default to dark

    constructor() {
        // Check local storage or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            this.setTheme('dark'); // Default to dark theme
        }
    }

    setTheme(theme: string) {
        this.currentTheme.set(theme);
        localStorage.setItem('theme', theme);

        const themeLink = document.getElementById('theme-css') as HTMLLinkElement;
        if (themeLink) {
            const themeFile = theme === 'dark' ? 'lara-dark-blue.css' : 'lara-light-blue.css';
            themeLink.href = `assets/themes/${themeFile}`;
        }
    }

    toggleTheme() {
        if (this.currentTheme() === 'light') {
            this.setTheme('dark');
        } else {
            this.setTheme('light');
        }
    }
}
