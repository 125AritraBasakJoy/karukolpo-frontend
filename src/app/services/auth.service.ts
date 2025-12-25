import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAdminLoggedInSubject = new BehaviorSubject<boolean>(false);
  isAdminLoggedIn$ = this.isAdminLoggedInSubject.asObservable();

  constructor(private router: Router) { }

  login(id: string, pass: string): boolean {
    const storedCreds = localStorage.getItem('adminCreds');
    let validId = 'badhan';
    let validPass = 'badhan@1971';

    if (storedCreds) {
      const parsed = JSON.parse(storedCreds);
      validId = parsed.username;
      validPass = parsed.password;
    }

    if (id === validId && pass === validPass) {
      this.isAdminLoggedInSubject.next(true);
      return true;
    }
    return false;
  }

  updateCredentials(username: string, pass: string) {
    localStorage.setItem('adminCreds', JSON.stringify({ username, password: pass }));
  }

  logout() {
    this.isAdminLoggedInSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    return this.isAdminLoggedInSubject.value;
  }
}
