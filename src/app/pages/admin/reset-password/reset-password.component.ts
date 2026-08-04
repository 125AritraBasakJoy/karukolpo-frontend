import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services';;;
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule, FormsModule, InputTextModule, ButtonModule,
    PasswordModule, CardModule, ToastModule, ProgressSpinnerModule,
    FloatLabelModule
  ],

  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  token: string | null = null;
  newPassword = '';
  confirmPassword = '';
  saving = signal<boolean>(false);
  resetSuccess = false;

  passwordRules = {
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  checkPasswordStrength() {
    const p = this.newPassword;
    this.passwordRules.length = p.length >= 6;
    this.passwordRules.upper = /[A-Z]/.test(p);
    this.passwordRules.lower = /[a-z]/.test(p);
    this.passwordRules.number = /\d/.test(p);
    this.passwordRules.special = /[@$!%*?&]/.test(p);
  }

  resetPassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Both fields are required' });
      return;
    }

    this.checkPasswordStrength();
    const r = this.passwordRules;
    if (!(r.length && r.upper && r.lower && r.number && r.special)) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please satisfy all password requirements' });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: 'Passwords do not match' });
      return;
    }

    this.saving.set(true);
    this.authService.resetPassword(this.token!, this.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetSuccess = true;
      },
      error: (error) => {
        console.error('Reset password error:', error);
        this.messageService.add({ life: 2000,
          severity: 'error',
          summary: 'Reset Failed',
          detail: error.error?.detail || 'The reset link may be expired or invalid. Please request a new one.'
        });
        this.saving.set(false);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/admin/login']);
  }
}
