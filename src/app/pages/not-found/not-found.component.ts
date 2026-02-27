import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule],
  template: `
    <div class="not-found-page">
      <div class="not-found-content">
        <!-- Animated 404 -->
        <div class="error-code">
          <span class="digit">4</span>
          <span class="digit zero">
            <i class="pi pi-search"></i>
          </span>
          <span class="digit">4</span>
        </div>

        <h1 class="error-title">Page Not Found</h1>
        <p class="error-description">
          Oops! The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        <div class="error-actions">
          <button pButton label="Go Home" icon="pi pi-home" class="action-btn-primary" routerLink="/"></button>
          <button pButton label="Go Back" icon="pi pi-arrow-left" class="action-btn-secondary" (click)="goBack()"></button>
        </div>

        <!-- Decorative dots -->
        <div class="decorative-dots">
          <span class="dot" *ngFor="let d of [1,2,3]"></span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #020617;
      padding: 2rem;
      position: relative;
      overflow: hidden;
    }

    .not-found-page::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
                  radial-gradient(circle at 70% 60%, rgba(139, 92, 246, 0.04) 0%, transparent 50%);
      animation: bgShift 15s ease-in-out infinite alternate;
    }

    @keyframes bgShift {
      0% { transform: translate(0, 0); }
      100% { transform: translate(5%, 3%); }
    }

    .not-found-content {
      text-align: center;
      position: relative;
      z-index: 1;
      max-width: 560px;
    }

    .error-code {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .digit {
      font-size: 8rem;
      font-weight: 900;
      color: #f8fafc;
      line-height: 1;
      letter-spacing: -0.04em;
      text-shadow: 0 0 40px rgba(59, 130, 246, 0.15);
    }

    .digit.zero {
      width: 8rem;
      height: 8rem;
      border: 4px solid rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      animation: pulse 3s ease-in-out infinite;
    }

    .digit.zero i {
      font-size: 3rem;
      color: #3b82f6;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); border-color: rgba(59, 130, 246, 0.3); }
      50% { transform: scale(1.05); border-color: rgba(59, 130, 246, 0.5); }
    }

    .error-title {
      font-size: 2rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 1rem 0;
      letter-spacing: -0.02em;
    }

    .error-description {
      font-size: 1.1rem;
      color: #94a3b8;
      line-height: 1.7;
      margin: 0 0 2.5rem 0;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    :host ::ng-deep .action-btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border: none !important;
      border-radius: 14px !important;
      padding: 0.85rem 2rem !important;
      font-weight: 600 !important;
      font-size: 1rem !important;
      box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.4) !important;
      transition: all 0.3s ease !important;
    }

    :host ::ng-deep .action-btn-primary:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 12px 28px -4px rgba(37, 99, 235, 0.5) !important;
    }

    :host ::ng-deep .action-btn-secondary {
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 14px !important;
      padding: 0.85rem 2rem !important;
      font-weight: 600 !important;
      font-size: 1rem !important;
      color: #f8fafc !important;
      transition: all 0.3s ease !important;
    }

    :host ::ng-deep .action-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-1px) !important;
    }

    .decorative-dots {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 3rem;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.3);
      animation: dotPulse 2s ease-in-out infinite;
    }

    .dot:nth-child(2) { animation-delay: 0.3s; }
    .dot:nth-child(3) { animation-delay: 0.6s; }

    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.5); }
    }

    @media (max-width: 480px) {
      .digit { font-size: 5rem; }
      .digit.zero { width: 5rem; height: 5rem; }
      .digit.zero i { font-size: 2rem; }
      .error-title { font-size: 1.5rem; }
      .error-description { font-size: 0.95rem; }
    }
  `]
})
export class NotFoundComponent {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  goBack() {
    if (isPlatformBrowser(this.platformId)) {
      window.history.back();
    }
  }
}
