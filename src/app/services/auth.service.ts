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
    if (id === 'badhan' && pass === 'badhan@1971') {
      this.isAdminLoggedInSubject.next(true);
      return true;
    }
    return false;
  }

  logout() {
    this.isAdminLoggedInSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    return this.isAdminLoggedInSubject.value;
  }
}
