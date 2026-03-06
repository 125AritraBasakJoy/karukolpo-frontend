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
          <div class="login-brand-header mb-5">
            <div class="brand-icon-circle">
              <i class="pi pi-shield"></i>
            </div>
            <div>
              <h2 class="login-heading">Admin Login</h2>
              <p class="login-subtitle">Dashboard Control Center</p>
            </div>
          </div>

          <div class="p-fluid mt-4">
            <div class="field mb-4">
              <label for="email" class="form-label-premium">EMAIL ADDRESS</label>
              <div class="p-inputgroup premium-form-inputgroup">
                <span class="p-inputgroup-addon">
                  <i class="pi pi-envelope"></i>
                </span>
                <input type="email" pInputText id="email" [(ngModel)]="email" autocomplete="email" placeholder="admin@karukolpo.com">
              </div>
            </div>
            <div class="field mb-5">
              <label for="password" class="form-label-premium">PASSWORD</label>
              <div class="p-inputgroup premium-form-inputgroup">
                <span class="p-inputgroup-addon">
                  <i class="pi pi-lock"></i>
                </span>
                <p-password id="password" [(ngModel)]="password" [feedback]="false" autocomplete="current-password" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" placeholder="••••••••"></p-password>
              </div>
            </div>
          </div>

          <button pButton label="Sign In to Dashboard" icon="pi pi-sign-in" (click)="login()" *ngIf="!loading()" class="w-full premium-login-btn"></button>
          
          <div *ngIf="loading()" class="flex justify-content-center py-3">
            <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
          </div>

          <div class="flex justify-content-center mt-5">
            <button pButton label="Forgot Password?" icon="pi pi-key" class="p-button-text p-button-secondary p-button-sm forgot-link-btn" (click)="showForgotPassword()"></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <p-dialog [(visible)]="displayForgotPasswordModal" [modal]="true" [style]="{width: '450px'}" styleClass="premium-dialog forgot-password-dialog" [draggable]="false" [resizable]="false">
      <ng-template pTemplate="header">
        <div class="flex align-items-center gap-3">
          <div class="header-icon-wrapper">
             <i class="pi pi-lock-open text-2xl"></i>
          </div>
          <div>
            <h2 class="m-0 text-xl font-bold text-white">Forgot Password</h2>
            <p class="m-0 text-xs text-slate-400 mt-1">Admin Account Recovery</p>
          </div>
        </div>
      </ng-template>
      <div class="p-fluid modal-body-content pt-4">
          <div class="instruction-card mb-4">
            <i class="pi pi-info-circle text-blue-400"></i>
            <p class="text-sm m-0">
                Enter your admin email address below. If the account exists, we'll send a password reset link to your inbox.
            </p>
          </div>

          <div class="field mb-0">
              <label for="forgotEmail" class="form-label mb-2">EMAIL ADDRESS</label>
              <div class="p-inputgroup premium-input-group">
                <span class="p-inputgroup-addon">
                    <i class="pi pi-envelope"></i>
                </span>
                <input type="email" pInputText id="forgotEmail" [(ngModel)]="forgotEmail" class="w-full" placeholder="name@karukolpo.com">
              </div>
          </div>
      </div>
      <ng-template pTemplate="footer">
          <div class="flex justify-content-end gap-3 mt-2">
              <button pButton label="Cancel" icon="pi pi-times" class="p-button-text cancel-btn" (click)="displayForgotPasswordModal=false"></button>
              <button
                  pButton
                  label="Send Reset Link"
                  icon="pi pi-send"
                  class="reset-btn"
                  (click)="sendForgotPassword()"
                  [disabled]="forgotPasswordLoading()"
                  *ngIf="!forgotPasswordLoading()">
              </button>
              <div *ngIf="forgotPasswordLoading()" class="loading-wrapper pr-4">
                <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
              </div>
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

    /* Main Login Form Styling */
    .login-form-panel {
      width: 520px;
      min-width: 460px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    }

    .login-form-inner {
      width: 100%;
      max-width: 400px;
    }

    .login-brand-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .brand-icon-circle {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #60a5fa;
      font-size: 1.5rem;
      box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.2);
    }

    .login-heading {
      font-size: 1.85rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.02em;
    }

    .login-subtitle {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .form-label-premium {
      display: block;
      margin-bottom: 0.75rem;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
    }

    :host ::ng-deep .premium-form-inputgroup,
    :host ::ng-deep .premium-input-group {
      display: flex !important;
      width: 100% !important;
      align-items: stretch !important;

      .p-inputgroup-addon {
        background: rgba(255, 255, 255, 0.03) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-right: none !important;
        color: #64748b !important;
        border-top-left-radius: 12px !important;
        border-bottom-left-radius: 12px !important;
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
        padding: 0 1.25rem !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 auto !important;
      }

      /* Force p-inputgroup children to behave as one unit */
      > input, 
      > p-password {
        flex: 1 1 auto !important;
        display: flex !important;
      }

      /* Apply 'joined' styles to the actual input element */
      > input,
      > p-password input {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        border-top-right-radius: 12px !important;
        border-bottom-right-radius: 12px !important;
        background: rgba(255, 255, 255, 0.02) !important;
        width: 100% !important;
        border-left: none !important;
      }

      /* Specific handling for p-password component wrapper */
      > p-password {
        .p-password {
          width: 100% !important;
          display: flex !important;
          
          input {
            flex: 1 1 auto !important;
          }
        }
      }

      &:focus-within {
        .p-inputgroup-addon {
          color: #3b82f6 !important;
          border-color: #3b82f6 !important;
          background: rgba(59, 130, 246, 0.05) !important;
        }
        input, .p-password input {
          border-color: #3b82f6 !important;
        }
      }
    }

    :host ::ng-deep .premium-login-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 1.1rem !important;
      font-weight: 700 !important;
      font-size: 1rem !important;
      letter-spacing: 0.02em;
      box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

      &:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.5) !important;
        filter: brightness(1.1);
      }
    }

    :host ::ng-deep .forgot-link-btn {
      color: #64748b !important;
      font-weight: 600 !important;
      background: rgba(255, 255, 255, 0.03) !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      padding: 0.6rem 1.2rem !important;
      border-radius: 10px !important;
      transition: all 0.2s ease !important;

      &:hover {
        background: rgba(255, 255, 255, 0.08) !important;
        color: #f8fafc !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
    }

    /* Forgot Password Modal Enhancements */
    :host ::ng-deep .forgot-password-dialog {
      .p-dialog-header {
        padding: 2rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
      }

      .header-icon-wrapper {
        width: 48px;
        height: 48px;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #60a5fa;
      }

      .instruction-card {
        background: rgba(59, 130, 246, 0.05);
        border-left: 3px solid #3b82f6;
        padding: 1rem;
        border-radius: 8px;
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        color: #94a3b8;
        line-height: 1.5;
      }

      .p-dialog-footer {
        padding: 1rem 2rem 2.5rem !important;
        border-top: none !important;
        background: transparent !important;
      }

      .cancel-btn {
        color: #94a3b8 !important;
        font-weight: 600 !important;
        padding: 1rem 1.5rem !important;
        border-radius: 14px !important;
        height: 52px !important;
        transition: all 0.3s ease !important;
        
        &:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          color: white !important;
          transform: translateY(-1px);
        }
      }

      .reset-btn {
        padding: 1rem 2rem !important;
        border-radius: 14px !important;
        font-weight: 700 !important;
        height: 52px !important;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
        border: none !important;
        box-shadow: 0 8px 20px -5px rgba(37, 99, 235, 0.45) !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        flex: 1 !important;
        justify-content: center !important;

        &:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 25px -5px rgba(37, 99, 235, 0.55) !important;
          filter: brightness(1.1);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed !important;
        }
      }
    }

    /* Responsive: Keep same layout, just adapt sizing */
    @media (max-width: 768px) {
      .login-form-panel {
        width: 100%;
        min-width: unset;
        padding: 2rem;
      }

      .login-image-panel {
        display: none;
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
          life: 2000,
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
          life: 2000
        });
        this.forgotPasswordLoading.set(false);
        this.displayForgotPasswordModal = false;
      },
      error: (error) => {
        console.error('Forgot password error:', error);
        this.messageService.add({
          life: 2000,
          severity: 'error',
          summary: 'Error',
          detail: error.error?.detail || 'Something went wrong. Please try again.'
        });
        this.forgotPasswordLoading.set(false);
      }
    });
  }
}
