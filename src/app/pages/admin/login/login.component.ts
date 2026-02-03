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
                    <button pButton label="Change Credentials" icon="pi pi-cog" class="p-button-text p-button-secondary p-button-sm" (click)="showChangeCreds()"></button>
                </div>
            </div>
            <div *ngIf="loading()" class="flex justify-content-center">
                <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
            </div>
        </ng-template>
      </p-card>

      <p-dialog header="Update Credentials" [(visible)]="displayChangeCredsModal" [modal]="true" [style]="{width: '450px'}">
        <div class="p-fluid">
            <div class="field mb-3">
                <label for="newUsername" class="font-bold block mb-2">New Username</label>
                <input pInputText id="newUsername" [(ngModel)]="newUsername" />
            </div>
            
            <div class="field mb-3">
                <label for="newPassword" class="font-bold block mb-2">New Password using this format - <span style="color: red;">badhan&#64;1971</span></label>
                <p-password id="newPassword" [(ngModel)]="newPassword" [toggleMask]="true" (ngModelChange)="checkPasswordStrength()"></p-password>
                
                <div class="mt-3 p-3 surface-ground border-round">
                    <div class="text-sm font-bold mb-2">Password Requirements:</div>
                    <ul class="list-none p-0 m-0 text-sm">
                        <li class="flex align-items-center mb-1" [ngClass]="{'text-green-500': passwordRules.length, 'text-gray-600': !passwordRules.length}">
                            <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.length, 'pi-circle': !passwordRules.length}"></i>
                            At least 6 characters
                        </li>
                        <li class="flex align-items-center mb-1" [ngClass]="{'text-green-500': passwordRules.upper, 'text-gray-600': !passwordRules.upper}">
                            <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.upper, 'pi-circle': !passwordRules.upper}"></i>
                            At least one uppercase letter (A-Z)
                        </li>
                        <li class="flex align-items-center mb-1" [ngClass]="{'text-green-500': passwordRules.lower, 'text-gray-600': !passwordRules.lower}">
                            <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.lower, 'pi-circle': !passwordRules.lower}"></i>
                            At least one lowercase letter (a-z)
                        </li>
                        <li class="flex align-items-center mb-1" [ngClass]="{'text-green-500': passwordRules.number, 'text-gray-600': !passwordRules.number}">
                            <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.number, 'pi-circle': !passwordRules.number}"></i>
                            At least one number (0-9)
                        </li>
                        <li class="flex align-items-center" [ngClass]="{'text-green-500': passwordRules.special, 'text-gray-600': !passwordRules.special}">
                            <i class="pi mr-2" [ngClass]="{'pi-check-circle': passwordRules.special, 'pi-circle': !passwordRules.special}"></i>
                            At least one special character (&#64;$!%*?&)
                        </li>
                    </ul>
                </div>
            </div>

            <div class="field mb-3">
                <label for="confirmPassword" class="font-bold block mb-2">Confirm Password</label>
                <p-password id="confirmPassword" [(ngModel)]="confirmPassword" [feedback]="false"></p-password>
            </div>
        </div>
        <ng-template pTemplate="footer">
            <p-button label="Cancel" icon="pi pi-times" styleClass="p-button-text" (click)="displayChangeCredsModal=false"></p-button>
            <p-button label="Update" icon="pi pi-check" (click)="updateCredentials()"></p-button>
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
      background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
      background-size: cover;
    }
    p-card {
      width: 420px;
    }
    ::ng-deep .login-container .p-card {
        background: var(--surface-card) !important;
        border: 1px solid var(--surface-border) !important;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal<boolean>(false);

  // Modal State
  displayChangeCredsModal = false;
  newUsername = '';
  newPassword = '';
  confirmPassword = '';

  passwordRules = {
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  };

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

  showChangeCreds() {
    this.displayChangeCredsModal = true;
    this.newUsername = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.resetRules();
  }

  resetRules() {
    this.passwordRules = {
      length: false,
      upper: false,
      lower: false,
      number: false,
      special: false
    };
  }

  checkPasswordStrength() {
    const p = this.newPassword;
    this.passwordRules.length = p.length >= 6;
    this.passwordRules.upper = /[A-Z]/.test(p);
    this.passwordRules.lower = /[a-z]/.test(p);
    this.passwordRules.number = /\d/.test(p);
    this.passwordRules.special = /[@$!%*?&]/.test(p);
  }

  resetPasswordForm() {
    this.newUsername = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.resetRules();
  }

  updateCredentials() {
    if (!this.newUsername || !this.newPassword) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'All fields are required' });
      return;
    }

    this.checkPasswordStrength(); // Ensure rules are up to date
    const r = this.passwordRules;
    const isValid = r.length && r.upper && r.lower && r.number && r.special;

    if (!isValid) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please satisfy all password requirements' });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.messageService.add({ severity: 'error', summary: 'Validation', detail: 'Passwords do not match' });
      return;
    }

    this.authService.updateCredentials(this.newUsername, this.newPassword);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Credentials updated. Please login.' });
    this.displayChangeCredsModal = false;
  }
}
