import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, map, of, catchError } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TimelineModule } from 'primeng/timeline';
import { OrderService } from '../../core/services/order/order.service';
import { Order } from '../../models/order.model';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ProductService } from '../../core/services/product/product.service';
import { DialogModule } from 'primeng/dialog';
import { formatPaymentStatus, PaymentStatusInfo, PaymentStatus } from '../../models/payment.model';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TimelineModule, ToastModule, ProgressSpinnerModule, TagModule, SkeletonModule, DialogModule],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.scss']
})
export class TrackOrderComponent {
  orderId = '';
  order = signal<Order | null>(null);
  ordersList = signal<Order[]>([]);
  loading = signal<boolean>(false);
  detailsLoading = signal<boolean>(false);
  searchedPhone = '';
  events: any[];

  // Navigation for latest orders (max 3)
  currentOrderIndex = signal<number>(0);
  private currentSelectToken = 0;
  private currentSearchGeneration = 0;

  // Cancellation Modal State
  displayCancelModal = false;
  cancelPhone = '';
  cancelOrderNo = '';
  cancelLoading = false;

  // Re-submit bKash TrxID State (A7)
  resubmitTrxId = signal<string>('');
  resubmitting = signal<boolean>(false);

  constructor(
    private orderService: OrderService,
    public productService: ProductService,
    private messageService: MessageService,
    private router: Router
  ) {
    this.events = [
      { status: 'Pending', icon: 'pi pi-shopping-cart', color: '#9C27B0' },
      { status: 'Confirmed', icon: 'pi pi-cog', color: '#673AB7' },
      { status: 'Shipping', icon: 'pi pi-truck', color: '#FF9800' },
      { status: 'Delivered', icon: 'pi pi-check', color: '#607D8B' }
    ];
  }

  getSeverity(status: string | undefined): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (status) {
      case 'Confirmed':
        return 'success';
      case 'Shipping':
        return 'info';
      case 'Delivered':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'Cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }

  getPaymentStatusInfo(order: Order | null): PaymentStatusInfo {
    if (!order) return { label: 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
    const raw = (order.payment_status || order.paymentStatus || '').toLowerCase().trim() as PaymentStatus;

    switch (raw) {
      case 'paid':
        return { label: 'Paid', severity: 'success', rawStatus: 'paid' };
      case 'partially_paid':
        return { label: 'Partially Paid', severity: 'warn', rawStatus: 'partially_paid' };
      case 'awaiting_verification':
        return { label: 'Awaiting Verification', severity: 'info', rawStatus: 'awaiting_verification' };
      case 'refund_due':
        return { label: 'Refund Pending', severity: 'danger', rawStatus: 'refund_due' };
      case 'refunded':
        return { label: 'Refunded', severity: 'secondary', rawStatus: 'refunded' };
      case 'void':
        return { label: 'Cancelled', severity: 'secondary', rawStatus: 'void' };
      case 'unpaid':
      default:
        return { label: 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
    }
  }

  hasOlderOrder(): boolean {
    return this.currentOrderIndex() < this.ordersList().length - 1;
  }

  hasNewerOrder(): boolean {
    return this.currentOrderIndex() > 0;
  }

  showOlderOrder() {
    if (!this.hasOlderOrder() || this.detailsLoading()) return;
    const nextIdx = this.currentOrderIndex() + 1;
    this.currentOrderIndex.set(nextIdx);
    const target = this.ordersList()[nextIdx];
    if (target) {
      this.selectOrder(target);
    }
  }

  showNewerOrder() {
    if (!this.hasNewerOrder() || this.detailsLoading()) return;
    const prevIdx = this.currentOrderIndex() - 1;
    this.currentOrderIndex.set(prevIdx);
    const target = this.ordersList()[prevIdx];
    if (target) {
      this.selectOrder(target);
    }
  }

  trackOrder() {
    if (!this.orderId) return;

    const searchGen = ++this.currentSearchGeneration;
    this.loading.set(true);
    this.order.set(null);
    this.ordersList.set([]);
    this.currentOrderIndex.set(0);

    const cleanPhone = this.orderId.replace(/[\s\-\(\)]/g, '');
    const isPhone = /^(\+?88)?0?1[3-9]\d{8}$/.test(cleanPhone);

    if (!isPhone) {
      this.messageService.add({
        life: 3000,
        severity: 'error',
        summary: 'Invalid Phone',
        detail: 'Please enter a valid phone number.'
      });
      this.loading.set(false);
      return;
    }

    let normalizedPhone = cleanPhone.replace(/^(\+?88)/, '');
    if (!normalizedPhone.startsWith('0')) {
      normalizedPhone = '0' + normalizedPhone;
    }
    this.searchedPhone = normalizedPhone;

    this.orderService.trackOrdersByPhone(normalizedPhone).subscribe({
      next: (orders) => {
        if (searchGen !== this.currentSearchGeneration) return;
        if (orders && orders.length > 0) {
          const sorted = orders.sort((a, b) =>
            new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
          );

          // Show at most the latest 3 orders for this phone number
          const latestThree = sorted.slice(0, 3);
          this.ordersList.set(latestThree);
          this.currentOrderIndex.set(0);
          this.selectOrder(latestThree[0]);
          this.loading.set(false);
        } else {
          this.messageService.add({
            life: 2000,
            severity: 'info',
            summary: 'Not Found',
            detail: 'No orders found for this phone number'
          });
          this.loading.set(false);
        }
      },
      error: (err) => {
        if (searchGen !== this.currentSearchGeneration) return;
        console.error('Phone tracking error:', err);
        this.loading.set(false);
        this.messageService.add({
          life: 2000,
          severity: 'error',
          summary: 'Error',
          detail: err.error?.detail || 'Failed to track order by phone number'
        });
      }
    });
  }

  selectOrder(selected: Order) {
    this.detailsLoading.set(true);
    const token = ++this.currentSelectToken;
    const searchGen = this.currentSearchGeneration;
    const orderNo = (selected.orderNumber || selected.id || '').trim().replace(/^#/, '');

    this.orderService.trackOrderByNumber(orderNo, this.searchedPhone).subscribe({
      next: (fullOrder) => {
        if (token !== this.currentSelectToken || searchGen !== this.currentSearchGeneration) return;
        this.resolveProductNames(fullOrder).subscribe(resolvedOrder => {
          if (token !== this.currentSelectToken || searchGen !== this.currentSearchGeneration) return;
          this.order.set(resolvedOrder);
          this.resubmitTrxId.set('');
          this.detailsLoading.set(false);
        });
      },
      error: (err) => {
        if (token !== this.currentSelectToken || searchGen !== this.currentSearchGeneration) return;
        console.error('Failed to fetch full order details:', err);
        this.resolveProductNames(selected).subscribe(resolvedOrder => {
          if (token !== this.currentSelectToken || searchGen !== this.currentSearchGeneration) return;
          this.order.set(resolvedOrder);
          this.resubmitTrxId.set('');
          this.detailsLoading.set(false);
        });
      }
    });
  }

  resubmitBkashTrx() {
    const currentOrder = this.order();
    if (!currentOrder || !currentOrder.id) return;

    const rawTrx = this.resubmitTrxId().trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(rawTrx)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid TrxID',
        detail: 'Transaction ID must be exactly 10 alphanumeric characters (e.g. BL99K7M80J)'
      });
      return;
    }

    this.resubmitting.set(true);
    const payload = {
      transaction_id: rawTrx,
      sender_phone: currentOrder.phoneNumber
    };

    this.orderService.submitTrx(currentOrder.id, payload, this.searchedPhone).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Submitted',
          detail: 'New Transaction ID submitted. Awaiting verification.'
        });
        this.resubmitting.set(false);
        this.selectOrder(currentOrder);
      },
      error: (err) => {
        this.resubmitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Submission Failed',
          detail: err.error?.detail || 'Failed to submit Transaction ID'
        });
      }
    });
  }

  private resolveProductNames(order: Order) {
    if (!order || !order.items || order.items.length === 0) {
      return of(order);
    }

    const resolutionObservables = order.items.map(item => {
      if (item.product?.imageUrl) {
        item.product.imageUrl = this.productService.getImageUrl(item.product.imageUrl);
      }

      if (item.product?.name && item.product?.imageUrl && !item.product.imageUrl.includes('data:image/svg+xml')) {
        return of(item);
      }

      const productId = item.product?.id || (item as any).product_id;
      if (productId) {
        return this.productService.getProductById(productId).pipe(
          map(product => {
            if (product) {
              item.product.name = item.product.name || product.name;
              item.product.imageUrl = product.imageUrl || this.productService.getImageUrl(null);
              item.product.price = item.product.price || product.price;
            } else {
              item.product.name = item.product.name || ('Product #' + productId);
              item.product.imageUrl = item.product.imageUrl || this.productService.getImageUrl(null);
            }
            return item;
          }),
          catchError(() => {
            item.product.name = item.product.name || ('Product #' + productId);
            item.product.imageUrl = item.product.imageUrl || this.productService.getImageUrl(null);
            return of(item);
          })
        );
      }

      item.product.imageUrl = item.product.imageUrl || this.productService.getImageUrl(null);
      return of(item);
    });

    return forkJoin(resolutionObservables).pipe(
      map(resolvedItems => {
        order.items = resolvedItems;
        return order;
      })
    );
  }

  cancelOrder() {
    this.cancelPhone = '';
    this.cancelOrderNo = '';
    this.displayCancelModal = true;
  }

  private normalizePhoneNumber(phone: string): string {
    const clean = phone.replace(/[\s\-\(\)\+]/g, '');
    let normalized = clean;
    if (normalized.startsWith('88')) {
      normalized = normalized.substring(2);
    }
    if (!normalized.startsWith('0') && normalized.length === 10) {
      normalized = '0' + normalized;
    }
    return normalized;
  }

  submitCancelRequest() {
    const currentOrder = this.order();
    if (!currentOrder || !currentOrder.id) {
      return;
    }

    const enteredPhone = this.cancelPhone.trim();
    const enteredOrderNo = this.cancelOrderNo.trim().toUpperCase();

    const correctPhone = currentOrder.phoneNumber || '';
    const correctOrderNo = (currentOrder.orderNumber || '').toUpperCase();
    const correctOrderId = currentOrder.id.toUpperCase();

    const normEntered = this.normalizePhoneNumber(enteredPhone);
    const normCorrect = this.normalizePhoneNumber(correctPhone);

    if (normEntered !== normCorrect) {
      this.messageService.add({
        life: 3000,
        severity: 'error',
        summary: 'Verification Failed',
        detail: 'Registered phone number does not match this order.'
      });
      return;
    }

    if (enteredOrderNo !== correctOrderNo && enteredOrderNo !== correctOrderId) {
      this.messageService.add({
        life: 3000,
        severity: 'error',
        summary: 'Verification Failed',
        detail: 'Order number does not match this order.'
      });
      return;
    }

    this.cancelLoading = true;
    this.orderService.cancelOrder(currentOrder.id, normEntered).subscribe({
      next: (cancelledOrder) => {
        this.cancelLoading = false;
        this.displayCancelModal = false;
        this.order.set(cancelledOrder);
        this.messageService.add({
          life: 3000,
          severity: 'success',
          summary: 'Order Cancelled',
          detail: 'Your order has been cancelled successfully.'
        });
      },
      error: (err) => {
        this.cancelLoading = false;
        console.error('Failed to cancel order:', err);
        this.messageService.add({
          life: 3000,
          severity: 'error',
          summary: 'Cancellation Failed',
          detail: err.error?.detail || 'Failed to cancel the order. Please contact support.'
        });
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
