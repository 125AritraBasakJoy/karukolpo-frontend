import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
    selector: 'app-loading',
    standalone: true,
    imports: [CommonModule, ProgressBarModule],
    template: `
    <div *ngIf="loadingService.loading()" class="loading-container">
      <div class="glow-bar"></div>
      <p-progressBar mode="indeterminate" [style]="{'height': '3px', 'background': 'transparent'}"></p-progressBar>
    </div>
  `,
    styles: [`
    .loading-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 99999;
      pointer-events: none;
    }

    .glow-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--primary-color), transparent);
      filter: blur(4px);
      opacity: 0.6;
    }

    :host ::ng-deep .p-progressbar {
      border-radius: 0;
    }

    :host ::ng-deep .p-progressbar-value {
      background: linear-gradient(90deg, var(--primary-color), var(--accent-color), var(--primary-color)) !important;
      background-size: 200% 100% !important;
      animation: gradient-flow 1.5s infinite linear !important;
    }

    @keyframes gradient-flow {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class LoadingComponent {
    constructor(public loadingService: LoadingService) { }
}
