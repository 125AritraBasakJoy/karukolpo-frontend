import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, PasswordModule, CardModule, ToastModule, ProgressSpinnerModule, DialogModule, FloatLabelModule],

  template: `
    <div class="login-split">
      <!-- Left: Image Panel -->
      <div class="login-image-panel">
        <img src="assets/login-bg.png" alt="Karukolpo Crafts" class="login-image">
        <div class="login-image-overlay"></div>
        <div class="login-image-content">
          <h1 class="brand-title">Karukolpo</h1>
          <p class="brand-tagline">Authentic Bangladeshi Handcrafts</p>
        </div>
      </div>

      <!-- Right: Login Panel -->
      <div class="login-form-panel">
        <div class="login-form-inner">
          <h2 class="login-heading">Admin Login</h2>
          <p class="login-subtitle">Enter your credentials to access the dashboard</p>

          <div class="p-fluid mt-5">
            <div class="field mb-4">
              <label for="email" class="form-label">Email Address</label>
              <input type="email" pInputText id="email" [(ngModel)]="email" autocomplete="email" class="w-full" placeholder="Enter your email">
            </div>
            <div class="field mb-4">
              <label for="password" class="form-label">Password</label>
              <p-password id="password" [(ngModel)]="password" [feedback]="false" autocomplete="new-password" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" [style]="{'width': '100%'}" placeholder="Enter your password"></p-password>
            </div>
          </div>

          <p-button label="Sign In" icon="pi pi-sign-in" (click)="login()" *ngIf="!loading()" styleClass="w-full login-btn"></p-button>
          <div *ngIf="loading()" class="flex justify-content-center py-3">
            <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
          </div>

          <div class="flex justify-content-center mt-4">
            <button pButton label="Forgot Password?" icon="pi pi-lock" class="p-button-text p-button-secondary p-button-sm" (click)="showForgotPassword()"></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <p-dialog header="Forgot Password" [(visible)]="displayForgotPasswordModal" [modal]="true" [style]="{width: '450px'}" styleClass="premium-dialog">
      <div class="p-fluid">
          <p class="text-sm mb-4" style="color: var(--text-color-secondary);">
              Enter your admin email address below. If the account exists, we'll send a password reset link to your inbox.
          </p>
          <div class="field mb-3">
              <p-floatlabel>
                  <input type="email" pInputText id="forgotEmail" [(ngModel)]="forgotEmail" class="w-full premium-input">
                  <label for="forgotEmail">Email Address</label>
              </p-floatlabel>
          </div>
      </div>
      <ng-template pTemplate="footer">
          <div class="flex justify-content-end gap-2">
              <p-button label="Cancel" icon="pi pi-times" styleClass="premium-btn-secondary" (click)="displayForgotPasswordModal=false"></p-button>
              <p-button
                  label="Send Password Reset Link"
                  icon="pi pi-send"
                  styleClass="premium-btn-primary"
                  (click)="sendForgotPassword()"
                  [disabled]="forgotPasswordLoading()"
                  *ngIf="!forgotPasswordLoading()">
              </p-button>
              <p-progressSpinner *ngIf="forgotPasswordLoading()" styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
          </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .login-split {
      display: flex;
      height: 100vh;
      width: 100%;
      overflow: hidden;
    }

    /* Left Panel — Image */
    .login-image-panel {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .login-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .login-image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        135deg,
        rgba(2, 6, 23, 0.6) 0%,
        rgba(15, 23, 42, 0.4) 50%,
        rgba(2, 6, 23, 0.7) 100%
      );
    }

    .login-image-content {
      position: absolute;
      bottom: 3rem;
      left: 3rem;
      color: white;
      z-index: 1;
    }

    .brand-title {
      font-size: 2.5rem;
      font-weight: 800;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    }

    .brand-tagline {
      font-size: 1.1rem;
      opacity: 0.85;
      margin: 0;
      font-weight: 400;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }

    /* Right Panel — Form */
    .login-form-panel {
      width: 480px;
      min-width: 420px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    }

    .login-form-inner {
      width: 100%;
      max-width: 380px;
    }

    .login-heading {
      font-size: 1.75rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }

    .login-subtitle {
      color: #94a3b8;
      font-size: 0.95rem;
      margin: 0;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      color: #94a3b8;
      font-weight: 500;
      font-size: 0.9rem;
    }

    :host ::ng-deep .login-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 0.9rem 1.5rem !important;
      font-weight: 600 !important;
      font-size: 1rem !important;
      box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.35) !important;
      transition: all 0.3s ease !important;
    }

    :host ::ng-deep .login-btn:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 12px 24px -4px rgba(37, 99, 235, 0.45) !important;
    }

    /* Responsive: Keep same layout, just adapt sizing */
    @media (max-width: 768px) {
      .login-form-panel {
        width: 320px;
        min-width: 280px;
        padding: 1.5rem;
      }

      .login-form-inner {
        max-width: 100%;
      }

      .login-heading {
        font-size: 1.35rem;
      }

      .login-subtitle {
        font-size: 0.85rem;
      }

      .form-label {
        font-size: 0.8rem;
      }

      .brand-title {
        font-size: 1.75rem;
      }

      .brand-tagline {
        font-size: 0.9rem;
      }

      .login-image-content {
        bottom: 1.5rem;
        left: 1.5rem;
      }
    }

    @media (max-width: 480px) {
      .login-form-panel {
        width: 260px;
        min-width: 220px;
        padding: 1.25rem;
      }

      .login-heading {
        font-size: 1.15rem;
      }

      .brand-title {
        font-size: 1.25rem;
      }

      .login-image-content {
        bottom: 1rem;
        left: 1rem;
      }
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal<boolean>(false);

  // Forgot Password Modal State
  displayForgotPasswordModal = false;
  forgotEmail = '';
  forgotPasswordLoading = signal<boolean>(false);

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) { }

  login() {
    if (!this.email || !this.password) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Email and password are required' });
      return;
    }

    this.loading.set(true);
    this.authService.login(this.email.trim(), this.password).subscribe({
      next: (response) => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Login successful' });
        this.router.navigate(['/admin/dashboard']);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Login error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Login Failed',
          detail: error.error?.detail || 'Invalid credentials'
        });
        this.loading.set(false);
      }
    });
  }

  showForgotPassword() {
    this.forgotEmail = '';
    this.displayForgotPasswordModal = true;
  }

  sendForgotPassword() {
    if (!this.forgotEmail || !this.forgotEmail.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please enter your email address' });
      return;
    }

    this.forgotPasswordLoading.set(true);
    this.authService.forgotPassword(this.forgotEmail.trim()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Email Sent',
          detail: 'If this account exists, a password reset link has been sent to your email.',
          life: 6000
        });
        this.forgotPasswordLoading.set(false);
        this.displayForgotPasswordModal = false;
      },
      error: (error) => {
        console.error('Forgot password error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.detail || 'Something went wrong. Please try again.'
        });
        this.forgotPasswordLoading.set(false);
      }
    });
  }
}
