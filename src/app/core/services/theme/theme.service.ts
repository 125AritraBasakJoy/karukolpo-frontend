import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    currentTheme = signal<string>('light');

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        if (isPlatformBrowser(this.platformId)) {
            const isAdmin = window.location.pathname.startsWith('/admin');
            const theme = isAdmin ? 'dark' : 'light';
            this.setTheme(theme);
        } else {
            this.currentTheme.set('light');
        }
    }

    setTheme(theme: string) {
        this.currentTheme.set(theme);

        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('theme', theme);

            const element = document.querySelector('html');
            if (element) {
                if (theme === 'dark') {
                    element.classList.add('dark-mode');
                } else {
                    element.classList.remove('dark-mode');
                }
            }
        }
    }

    toggleTheme() {
        const nextTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
    }
}
