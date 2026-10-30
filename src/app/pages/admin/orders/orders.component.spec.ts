import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Subject, of } from 'rxjs';
import { OrdersComponent } from './orders.component';
import { OrderService, ProductService, PaymentService, NotificationService } from '../../../core/services';
import { Order } from '../../../models/order.model';

describe('OrdersComponent pagination', () => {
  let component: OrdersComponent;
  let getOrders: jasmine.Spy;
  let getOrdersWithCount: jasmine.Spy;

  beforeEach(() => {
    spyOn(OrdersComponent.prototype, 'ngOnInit');
    getOrders = jasmine.createSpy('getOrders');
    getOrdersWithCount = jasmine.createSpy('getOrdersWithCount');
    TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: OrderService, useValue: { getOrders, getOrdersWithCount, clearCache: () => {} } },
        { provide: ProductService, useValue: {} },
        { provide: PaymentService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        MessageService
      ]
    });
    component = TestBed.createComponent(OrdersComponent).componentInstance;
  });

  function orders(count: number, start = 0): Order[] {
    return Array.from({ length: count }, (_, index) => ({
      id: String(start + index), orderDate: new Date(), items: []
    } as unknown as Order));
  }

  for (const terminalCount of [37, 0]) {
    it(`handles a ${terminalCount}-row terminal second page at 100 rows per page`, () => {
      getOrdersWithCount.and.callFake((options: any) => {
        const skip = options.skip || 0;
        const total = 100 + terminalCount;
        return of({ items: skip === 0 ? orders(100) : orders(terminalCount, 100), total });
      });
      component.loadOrders({ first: 0, rows: 100 });
      expect(component.totalRecords()).toBe(100 + terminalCount);
      component.loadOrders({ first: 100, rows: 100 });
      expect(component.totalRecords()).toBe(100 + terminalCount);
      expect(component.orders().length).toBe(terminalCount);
      expect(component.loading()).toBeFalse();
    });
  }

  it('clears the terminal boundary on refresh so new orders can be fetched', () => {
    getOrdersWithCount.and.returnValues(
      of({ items: [], total: 0 }),
      of({ items: orders(100), total: 112 }),
      of({ items: orders(12, 100), total: 112 })
    );
    component.loadOrders({ first: 0, rows: 100 });
    expect(component.totalRecords()).toBe(0);
    component.refreshOrders();
    component.loadOrders({ first: 100, rows: 100 });
    expect(component.orders().length).toBe(12);
    expect(component.totalRecords()).toBe(112);
  });

  it('keeps the same lazy table mounted while a request is pending', () => {
    const response = new Subject<any>();
    getOrdersWithCount.and.returnValue(response);
    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(Table)).componentInstance).toBe(table);
    expect(table.loading).toBeTrue();
    response.next({ items: [], total: 0 });
    response.complete();
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(Table)).componentInstance).toBe(table);
    expect(table.loading).toBeFalse();
    expect(getOrdersWithCount).toHaveBeenCalledTimes(1);
  });

  it('keeps the orders table wrapper visible and does not render separate mobile cards', () => {
    getOrdersWithCount.and.returnValue(of({ items: [], total: 0 }));
    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    const tableEl = fixture.debugElement.query(By.directive(Table));
    expect(tableEl).toBeTruthy();
    const tableWrapper = tableEl.nativeElement.closest('.overflow-x-auto');
    expect(tableWrapper).toBeTruthy();
    expect(tableWrapper.classList.contains('hidden')).toBeFalse();
    const mobileCards = fixture.debugElement.query(By.css('.mobile-orders-cards'));
    expect(mobileCards).toBeNull();
  });
});
