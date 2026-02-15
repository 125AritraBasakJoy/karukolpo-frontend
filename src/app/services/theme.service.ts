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
        // Force dark theme regardless of input
        const enforcedTheme = 'dark';
        this.currentTheme.set(enforcedTheme);
        localStorage.setItem('theme', enforcedTheme);

        const element = document.querySelector('html');
        if (element) {
            // Always add dark-mode class
            element.classList.add('dark-mode');
        }
    }

    toggleTheme() {
        console.warn('Light mode is disabled. Staying in dark mode.');
        this.setTheme('dark');
    }
}
