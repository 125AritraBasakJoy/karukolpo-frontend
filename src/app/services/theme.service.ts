import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    currentTheme = signal<string>('dark'); // Changed default to dark

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        // Check local storage or system preference
        if (isPlatformBrowser(this.platformId)) {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                this.setTheme(savedTheme);
            } else {
                this.setTheme('dark'); // Default to dark theme
            }
        } else {
            this.currentTheme.set('dark');
        }
    }

    setTheme(theme: string) {
        // Force dark theme regardless of input
        const enforcedTheme = 'dark';
        this.currentTheme.set(enforcedTheme);

        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('theme', enforcedTheme);

            const element = document.querySelector('html');
            if (element) {
                // Always add dark-mode class
                element.classList.add('dark-mode');
            }
        }
    }

    toggleTheme() {
        console.warn('Light mode is disabled. Staying in dark mode.');
        this.setTheme('dark');
    }
}
