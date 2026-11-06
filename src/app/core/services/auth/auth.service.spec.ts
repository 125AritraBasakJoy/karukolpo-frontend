import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, SessionExpiredError } from './auth.service';
import { CategoryService } from '../category/category.service';
import { ADMIN_API } from './admin.api';

describe('AuthService refresh and logout flow', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: CategoryService, useValue: { clearCache: jasmine.createSpy('clearCache') } }
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('returns current token without network call if token changed since staleToken', async () => {
    localStorage.setItem('adminToken', 'new-token');
    const token = await service.ensureFreshAccessToken('old-stale-token');
    expect(token).toBe('new-token');
    httpMock.expectNone(ADMIN_API.REFRESH);
  });

  it('refreshes token under lock and updates localStorage on success', async () => {
    localStorage.setItem('adminToken', 'stale-token');
    localStorage.setItem('adminRefreshToken', 'valid-refresh');

    const refreshPromise = service.ensureFreshAccessToken('stale-token');
    await new Promise(resolve => setTimeout(resolve, 10));

    const req = httpMock.expectOne(ADMIN_API.REFRESH);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refresh_token: 'valid-refresh' });
    req.flush({ access_token: 'refreshed-token', refresh_token: 'next-refresh' });

    const result = await refreshPromise;
    expect(result).toBe('refreshed-token');
    expect(localStorage.getItem('adminToken')).toBe('refreshed-token');
    expect(localStorage.getItem('adminRefreshToken')).toBe('next-refresh');
  });

  it('throws SessionExpiredError when refresh returns 401', async () => {
    localStorage.setItem('adminToken', 'stale-token');
    localStorage.setItem('adminRefreshToken', 'expired-refresh');

    const refreshPromise = service.ensureFreshAccessToken('stale-token');
    await new Promise(resolve => setTimeout(resolve, 10));

    const req = httpMock.expectOne(ADMIN_API.REFRESH);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    await expectAsync(refreshPromise).toBeRejectedWith(jasmine.any(SessionExpiredError));
  });

  it('notifies backend on logout when refresh token is present', () => {
    localStorage.setItem('adminToken', 'token-123');
    localStorage.setItem('adminRefreshToken', 'refresh-123');

    service.logout();

    const req = httpMock.expectOne(ADMIN_API.LOGOUT);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refresh_token: 'refresh-123' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(localStorage.getItem('adminRefreshToken')).toBeNull();
  });
});
