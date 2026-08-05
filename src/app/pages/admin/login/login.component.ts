import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, PwaInstallService } from '../../../core/services';
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

  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  loading = signal<boolean>(false);

  // Forgot Password Modal State
  displayForgotPasswordModal = false;
  forgotEmail = '';
  forgotPasswordLoading = signal<boolean>(false);

  // PWA Install Prompt State
  displayInstallDialog = signal<boolean>(false);
  displayIosInstallDialog = signal<boolean>(false);
  installPromptShown = false;
  installing = signal<boolean>(false);

  private installCheckTimer: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private pwaInstallService: PwaInstallService
  ) { }

  ngOnInit(): void {
    this.scheduleInstallPrompt();
  }

  ngOnDestroy(): void {
    if (this.installCheckTimer) {
      clearTimeout(this.installCheckTimer);
    }
  }

  /** Periodically check whether the PWA install prompt should appear. */
  private scheduleInstallPrompt(): void {
    const attempt = (delay: number) => {
      this.installCheckTimer = setTimeout(() => {
        this.maybeShowInstallPrompt();
        if (!this.installPromptShown) {
          attempt(delay);
        }
      }, delay);
    };
    attempt(1200);
  }

  private maybeShowInstallPrompt(): void {
    if (this.installPromptShown) return;
    if (!this.pwaInstallService.shouldShow()) return;

    this.installPromptShown = true;
    if (this.pwaInstallService.isIOS()) {
      this.displayIosInstallDialog.set(true);
    } else {
      this.displayInstallDialog.set(true);
    }
  }

  async confirmInstall(): Promise<void> {
    this.installing.set(true);
    const accepted = await this.pwaInstallService.promptInstall();
    this.installing.set(false);
    this.displayInstallDialog.set(false);
    if (accepted) {
      this.messageService.add({
        severity: 'success',
        summary: 'App Installed',
        detail: 'Karukolpo Admin has been added to your device.',
        life: 3000
      });
    }
  }

  dismissInstall(): void {
    this.pwaInstallService.markDismissed();
    this.displayInstallDialog.set(false);
    this.displayIosInstallDialog.set(false);
  }

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
