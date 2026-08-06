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
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TimelineModule, ToastModule, ProgressSpinnerModule, TagModule, SkeletonModule, ThemeToggleComponent, DialogModule],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.scss']
})
export class TrackOrderComponent {
  orderId = '';
  order = signal<Order | null>(null);
  loading = signal<boolean>(false);
  events: any[];

  // Cancellation Modal State
  displayCancelModal = false;
  cancelPhone = '';
  cancelOrderNo = '';
  cancelLoading = false;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
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

  trackOrder() {
    if (!this.orderId) return;

    this.loading.set(true);
    this.order.set(null);

    const cleanPhone = this.orderId.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
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

    // Normalize phone number to 11 digits (01XXXXXXXXX format)
    let normalizedPhone = cleanPhone;

    // Remove +88 or 88 prefix if present
    normalizedPhone = normalizedPhone.replace(/^(\+?88)/, '');

    // Ensure it starts with 0
    if (!normalizedPhone.startsWith('0')) {
      normalizedPhone = '0' + normalizedPhone;
    }

    this.orderService.trackOrdersByPhone(normalizedPhone).subscribe({
      next: (orders) => {
        if (orders && orders.length > 0) {
          // Sort by date descending and get the most recent order
          const sorted = orders.sort((a, b) =>
            new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
          );

          const mostRecent = sorted[0];

          // Fetch the FULL order details using the order_number and phone to populate ID, items, and address
          this.orderService.trackOrderByNumber(mostRecent.orderNumber || '', normalizedPhone).subscribe({
            next: (fullOrder) => {
              this.resolveProductNames(fullOrder).subscribe(resolvedOrder => {
                this.order.set(resolvedOrder);
                this.loading.set(false);
              });
            },
            error: (err) => {
              console.error('Failed to fetch full order details:', err);
              // Fallback to trimmed order if full lookup fails
              this.resolveProductNames(mostRecent).subscribe(resolvedOrder => {
                this.order.set(resolvedOrder);
                this.loading.set(false);
              });
            }
          });
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

  /**
   * Resolve product names for order items if they are missing
   */
  private resolveProductNames(order: Order) {
    if (!order || !order.items || order.items.length === 0) {
      return of(order);
    }

    const resolutionObservables = order.items.map(item => {
      // If product name is already present, return item as is
      if (item.product?.name) {
        return of(item);
      }

      // If product ID is present but name is missing, fetch product info
      const productId = item.product?.id;
      if (productId) {
        return this.productService.getProductById(productId).pipe(
          map(product => {
            if (product) {
              item.product.name = product.name;
              item.product.imageUrl = product.imageUrl;
              item.product.price = item.product.price || product.price;
            } else {
              item.product.name = 'Product #' + productId;
            }
            return item;
          }),
          catchError(() => {
            item.product.name = 'Product #' + productId;
            return of(item);
          })
        );
      }

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
      console.warn('Cannot cancel order: currentOrder or order ID is missing.', currentOrder);
      return;
    }

    const enteredPhone = this.cancelPhone.trim();
    const enteredOrderNo = this.cancelOrderNo.trim().toUpperCase();
    
    const correctPhone = currentOrder.phoneNumber || '';
    const correctOrderNo = (currentOrder.orderNumber || '').toUpperCase();
    const correctOrderId = currentOrder.id.toUpperCase();

    // Normalize phone numbers to compare
    const normEntered = this.normalizePhoneNumber(enteredPhone);
    const normCorrect = this.normalizePhoneNumber(correctPhone);

    console.log('Verifying cancellation info:', {
      enteredPhone,
      enteredOrderNo,
      correctPhone,
      correctOrderNo,
      correctOrderId,
      normEntered,
      normCorrect
    });

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
    this.orderService.cancelOrder(currentOrder.id, enteredPhone, { reason: 'Cancelled by customer' }).subscribe({
      next: (updatedOrder) => {
        this.order.set(updatedOrder);
        this.cancelLoading = false;
        this.displayCancelModal = false;
        this.messageService.add({
          life: 3000,
          severity: 'success',
          summary: 'Order Cancelled',
          detail: 'Your order has been cancelled successfully.'
        });
      },
      error: (err) => {
        console.error('Order cancellation failed:', err);
        this.cancelLoading = false;
        this.messageService.add({
          life: 3000,
          severity: 'error',
          summary: 'Cancellation Failed',
          detail: err.error?.detail || 'Failed to cancel the order. Please try again.'
        });
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
