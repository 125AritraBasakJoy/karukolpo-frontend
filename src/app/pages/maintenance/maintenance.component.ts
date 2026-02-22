import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'app-maintenance',
    standalone: true,
    imports: [CommonModule, ButtonModule],
    template: `
    <div class="maintenance-page">
      <div class="maintenance-content">
        <!-- Animated gear icon -->
        <div class="icon-wrapper">
          <div class="gear-ring">
            <i class="pi pi-cog gear-icon"></i>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>

        <h1 class="maintenance-title">Under Maintenance</h1>
        <p class="maintenance-description">
          We're currently improving things behind the scenes.<br>
          Our team is working hard to bring you a better experience. We'll be back shortly!
        </p>

        <div class="info-cards">
          <div class="info-card">
            <i class="pi pi-wrench"></i>
            <span>Upgrading Systems</span>
          </div>
          <div class="info-card">
            <i class="pi pi-clock"></i>
            <span>Back Soon</span>
          </div>
          <div class="info-card">
            <i class="pi pi-shield"></i>
            <span>Data Safe</span>
          </div>
        </div>

        <div class="contact-hint">
          <i class="pi pi-envelope"></i>
          <span>Need urgent help? Email us at <strong>support&#64;karukolpo.com</strong></span>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .maintenance-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #020617;
      padding: 2rem;
      position: relative;
      overflow: hidden;
    }

    .maintenance-page::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 40% 30%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
                  radial-gradient(circle at 60% 70%, rgba(59, 130, 246, 0.04) 0%, transparent 50%);
      animation: bgDrift 20s ease-in-out infinite alternate;
    }

    @keyframes bgDrift {
      0% { transform: translate(0, 0) rotate(0deg); }
      100% { transform: translate(3%, 2%) rotate(1deg); }
    }

    .maintenance-content {
      text-align: center;
      position: relative;
      z-index: 1;
      max-width: 600px;
    }

    .icon-wrapper {
      margin-bottom: 2.5rem;
    }

    .gear-ring {
      width: 100px;
      height: 100px;
      border: 3px solid rgba(245, 158, 11, 0.2);
      border-radius: 50%;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: gearPulse 4s ease-in-out infinite;
    }

    .gear-icon {
      font-size: 2.5rem;
      color: #f59e0b;
      animation: spin 8s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes gearPulse {
      0%, 100% { border-color: rgba(245, 158, 11, 0.2); }
      50% { border-color: rgba(245, 158, 11, 0.4); }
    }

    .progress-bar {
      width: 200px;
      height: 4px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
      margin: 0 auto;
    }

    .progress-fill {
      width: 40%;
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #eab308);
      border-radius: 4px;
      animation: progressMove 3s ease-in-out infinite;
    }

    @keyframes progressMove {
      0% { width: 10%; margin-left: 0; }
      50% { width: 60%; margin-left: 20%; }
      100% { width: 10%; margin-left: 90%; }
    }

    .maintenance-title {
      font-size: 2.25rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 1rem 0;
      letter-spacing: -0.02em;
    }

    .maintenance-description {
      font-size: 1.05rem;
      color: #94a3b8;
      line-height: 1.8;
      margin: 0 0 2.5rem 0;
    }

    .info-cards {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2.5rem;
      flex-wrap: wrap;
    }

    .info-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #cbd5e1;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .info-card:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
    }

    .info-card i {
      color: #f59e0b;
      font-size: 1.1rem;
    }

    .contact-hint {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 100px;
      padding: 0.6rem 1.25rem;
    }

    .contact-hint i {
      color: #94a3b8;
    }

    .contact-hint strong {
      color: #cbd5e1;
    }

    @media (max-width: 480px) {
      .maintenance-title { font-size: 1.5rem; }
      .maintenance-description { font-size: 0.9rem; }
      .info-cards { flex-direction: column; align-items: center; }
      .contact-hint { font-size: 0.75rem; }
    }
  `]
})
export class MaintenanceComponent { }
