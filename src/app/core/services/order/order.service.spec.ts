import { TestBed } from '@angular/core/testing';
import { HttpResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { OrderService } from './order.service';
import { ApiService } from '../api/api.service';
import { ORDERS_API } from './order.api';

describe('OrderService', () => {
  let service: OrderService;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiServiceSpy = jasmine.createSpyObj('ApiService', ['getResponse', 'get', 'post', 'patch', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        OrderService,
        { provide: ApiService, useValue: apiServiceSpy }
      ]
    });

    service = TestBed.inject(OrderService);
  });

  describe('getOrdersWithCount', () => {
    it('serializes status and pagination params correctly for pending and confirmed tabs', (done) => {
      const mockResponse = new HttpResponse({
        body: [],
        headers: new HttpHeaders({ 'X-Total-Count': '0' })
      });
      apiServiceSpy.getResponse.and.returnValue(of(mockResponse));

      service.getOrdersWithCount({ status: 'pending', skip: 0, limit: 10 }).subscribe({
        next: (res) => {
          expect(apiServiceSpy.getResponse).toHaveBeenCalledWith(
            `${ORDERS_API.LIST}?skip=0&limit=10&status=pending`
          );
          expect(res.items).toEqual([]);
          expect(res.total).toBe(0);

          service.getOrdersWithCount({ status: 'confirmed', skip: 20, limit: 10 }).subscribe({
            next: (resConfirmed) => {
              expect(apiServiceSpy.getResponse).toHaveBeenCalledWith(
                `${ORDERS_API.LIST}?skip=20&limit=10&status=confirmed`
              );
              expect(resConfirmed.total).toBe(0);
              done();
            }
          });
        }
      });
    });

    it('parses array body and X-Total-Count header', (done) => {
      const mockOrder = {
        id: 'ord-123',
        order_number: 'ORD-123',
        status: 'pending',
        total: '150.00',
        created_at: '2026-11-07T00:00:00Z',
        items: []
      };
      const mockResponse = new HttpResponse({
        body: [mockOrder],
        headers: new HttpHeaders({ 'X-Total-Count': '42' })
      });
      apiServiceSpy.getResponse.and.returnValue(of(mockResponse));

      service.getOrdersWithCount().subscribe({
        next: (res) => {
          expect(res.items.length).toBe(1);
          expect(res.items[0].id).toBe('ord-123');
          expect(res.total).toBe(42);
          done();
        }
      });
    });

    it('throws error when response body is not an array', (done) => {
      const mockResponse = new HttpResponse({
        body: { items: [], total: 0 } as any,
        headers: new HttpHeaders()
      });
      apiServiceSpy.getResponse.and.returnValue(of(mockResponse));

      service.getOrdersWithCount().subscribe({
        next: () => fail('expected error'),
        error: (err) => {
          expect(err.message).toContain('Malformed orders response');
          done();
        }
      });
    });

    it('throws error when X-Total-Count is not a valid non-negative integer', (done) => {
      const mockResponse = new HttpResponse({
        body: [],
        headers: new HttpHeaders({ 'X-Total-Count': 'invalid-number' })
      });
      apiServiceSpy.getResponse.and.returnValue(of(mockResponse));

      service.getOrdersWithCount().subscribe({
        next: () => fail('expected error'),
        error: (err) => {
          expect(err.message).toContain('Invalid X-Total-Count header');
          done();
        }
      });
    });
  });
});
