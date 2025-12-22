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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, PasswordModule, CardModule, ToastModule, ProgressSpinnerModule],
  providers: [MessageService],
  template: `
    <div class="login-container">
      <p-card header="Admin Login">
        <div class="p-fluid">
          <div class="p-field mb-3">
            <span class="p-float-label">
              <input type="text" pInputText id="username" [(ngModel)]="username" autocomplete="off" class="ng-dirty">
              <label for="username">Username</label>
            </span>
          </div>
          <div class="p-field mb-3">
            <span class="p-float-label">
              <p-password id="password" [(ngModel)]="password" [feedback]="false" autocomplete="new-password" styleClass="ng-dirty"></p-password>
              <label for="password">Password</label>
            </span>
          </div>
        </div>
        <ng-template pTemplate="footer">
            <p-button label="Login" icon="pi pi-sign-in" (click)="login()" *ngIf="!loading()"></p-button>
            <div *ngIf="loading()" class="flex justify-content-center">
                <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
            </div>
        </ng-template>
      </p-card>
    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f4f4f4;
    }
    p-card {
      width: 360px;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal<boolean>(false);

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) { }

  login() {
    this.loading.set(true);
    // Simulate API delay
    setTimeout(() => {
      if (this.authService.login(this.username, this.password)) {
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.messageService.add({ severity: 'error', summary: 'Login Failed', detail: 'Invalid credentials' });
        this.loading.set(false);
      }
    }, 1000);
  }
}
