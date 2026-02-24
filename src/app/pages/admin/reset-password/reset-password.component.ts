import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
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

  template: `
    <div class="reset-container">
      <!-- No token → error state -->
      <p-card *ngIf="!token" header="Invalid Link" styleClass="shadow-4 max-w-26rem mx-auto">
        <div class="text-center">
          <i class="pi pi-exclamation-triangle" style="font-size: 3rem; color: var(--red-400);"></i>
          <p class="mt-3">This password reset link is invalid or has expired.</p>
          <p-button label="Back to Login" icon="pi pi-arrow-left" styleClass="mt-3" (click)="goToLogin()"></p-button>
        </div>
      </p-card>

      <!-- Has token → reset form -->
      <p-card *ngIf="token && !resetSuccess" header="Reset Password" styleClass="shadow-4 max-w-26rem mx-auto">
        <div class="p-fluid pt-2">
          <p class="text-sm mb-4" style="color: var(--text-color-secondary);">
            Enter your new password below.
          </p>

          <div class="field mb-5">
            <p-floatlabel>
              <p-password id="newPassword" [(ngModel)]="newPassword" [toggleMask]="true"
                          [feedback]="false" styleClass="w-full" inputStyleClass="w-full"
                          [style]="{'width': '100%'}" (ngModelChange)="checkPasswordStrength()">
              </p-password>
              <label for="newPassword">New Password</label>
            </p-floatlabel>
          </div>

          <div class="field mb-4">
            <p-floatlabel>
              <p-password id="confirmPassword" [(ngModel)]="confirmPassword" [toggleMask]="true"
                          [feedback]="false" styleClass="w-full" inputStyleClass="w-full"
                          [style]="{'width': '100%'}">
              </p-password>
              <label for="confirmPassword">Confirm Password</label>
            </p-floatlabel>
          </div>

          <!-- Password strength checklist -->
          <div class="p-3 surface-ground border-round mb-3">
            <div class="text-sm font-bold mb-2">Password Requirements:</div>
            <ul class="list-none p-0 m-0 text-sm">
              <li class="flex align-items-center mb-1"
                  [ngClass]="{'text-green-500': passwordRules.length, 'text-gray-600': !passwordRules.length}">
                <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.length, 'pi-circle': !passwordRules.length}"></i>
                At least 6 characters
              </li>
              <li class="flex align-items-center mb-1"
                  [ngClass]="{'text-green-500': passwordRules.upper, 'text-gray-600': !passwordRules.upper}">
                <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.upper, 'pi-circle': !passwordRules.upper}"></i>
                At least one uppercase letter (A-Z)
              </li>
              <li class="flex align-items-center mb-1"
                  [ngClass]="{'text-green-500': passwordRules.lower, 'text-gray-600': !passwordRules.lower}">
                <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.lower, 'pi-circle': !passwordRules.lower}"></i>
                At least one lowercase letter (a-z)
              </li>
              <li class="flex align-items-center mb-1"
                  [ngClass]="{'text-green-500': passwordRules.number, 'text-gray-600': !passwordRules.number}">
                <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.number, 'pi-circle': !passwordRules.number}"></i>
                At least one number (0-9)
              </li>
              <li class="flex align-items-center"
                  [ngClass]="{'text-green-500': passwordRules.special, 'text-gray-600': !passwordRules.special}">
                <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.special, 'pi-circle': !passwordRules.special}"></i>
                At least one special character (&#64;$!%*?&)
              </li>
            </ul>
          </div>
        </div>

        <ng-template pTemplate="footer">
          <div class="flex flex-column gap-3">
            <p-button label="Save New Password" icon="pi pi-check" (click)="resetPassword()"
                      *ngIf="!saving()" styleClass="w-full"></p-button>
            <div *ngIf="saving()" class="flex justify-content-center">
              <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
            </div>
          </div>
        </ng-template>
      </p-card>

      <!-- Success state -->
      <p-card *ngIf="resetSuccess" header="Password Reset Successful" styleClass="shadow-4 max-w-26rem mx-auto">
        <div class="text-center">
          <i class="pi pi-check-circle" style="font-size: 3rem; color: var(--green-400);"></i>
          <p class="mt-3">Your password has been reset successfully. You can now log in with your new password.</p>
          <p-button label="Go to Login" icon="pi pi-sign-in" styleClass="mt-3" (click)="goToLogin()"></p-button>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .reset-container {
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
        this.messageService.add({
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
