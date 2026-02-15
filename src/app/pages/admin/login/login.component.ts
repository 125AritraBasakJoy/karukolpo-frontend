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
  providers: [MessageService],
  template: `
    <div class="login-container">
      <p-card header="Admin Login" styleClass="shadow-4 max-w-26rem mx-auto">
        <div class="p-fluid pt-4">
          <div class="field mb-5">
            <p-floatlabel>
              <input type="email" pInputText id="email" [(ngModel)]="email" autocomplete="email" class="w-full">
              <label for="email">Email</label>
            </p-floatlabel>
          </div>
          <div class="field mb-5">
            <p-floatlabel>
              <p-password id="password" [(ngModel)]="password" [feedback]="false" autocomplete="new-password" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" [style]="{'width': '100%'}"></p-password>
              <label for="password">Password</label>
            </p-floatlabel>
          </div>
        </div>
        <ng-template pTemplate="footer">
            <div class="flex flex-column gap-3">
                <p-button label="Login" icon="pi pi-sign-in" (click)="login()" *ngIf="!loading()" styleClass="w-full"></p-button>
                <div class="flex justify-content-center">
                    <button pButton label="Forgot Password?" icon="pi pi-lock" class="p-button-text p-button-secondary p-button-sm" (click)="showForgotPassword()"></button>
                </div>
            </div>
            <div *ngIf="loading()" class="flex justify-content-center">
                <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
            </div>
        </ng-template>
      </p-card>

      <!-- Forgot Password Modal -->
      <p-dialog header="Forgot Password" [(visible)]="displayForgotPasswordModal" [modal]="true" [style]="{width: '450px'}">
        <div class="p-fluid">
            <p class="text-sm mb-4" style="color: var(--text-color-secondary);">
                Enter your admin email address below. If the account exists, we'll send a password reset link to your inbox.
            </p>
            <div class="field mb-3">
                <p-floatlabel>
                    <input type="email" pInputText id="forgotEmail" [(ngModel)]="forgotEmail" class="w-full">
                    <label for="forgotEmail">Email Address</label>
                </p-floatlabel>
            </div>
        </div>
        <ng-template pTemplate="footer">
            <div class="flex justify-content-end gap-2">
                <p-button label="Cancel" icon="pi pi-times" styleClass="p-button-text" (click)="displayForgotPasswordModal=false"></p-button>
                <p-button
                    label="Send Password Reset Link"
                    icon="pi pi-send"
                    (click)="sendForgotPassword()"
                    [disabled]="forgotPasswordLoading()"
                    *ngIf="!forgotPasswordLoading()">
                </p-button>
                <p-progressSpinner *ngIf="forgotPasswordLoading()" styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
            </div>
        </ng-template>
      </p-dialog>
    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    p-card {
      width: 420px;
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
