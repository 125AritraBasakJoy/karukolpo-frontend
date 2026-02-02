import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-theme-toggle',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    templateUrl: './theme-toggle.component.html',
    styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent {
    constructor(public themeService: ThemeService) { }

    toggleTheme() {
        this.themeService.toggleTheme();
    }
}
