import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, map, of, catchError } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TimelineModule } from 'primeng/timeline';
import { OrderService } from '../../services/order.service';
import { Order } from '../../models/order.model';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ProductService } from '../../services/product.service';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TimelineModule, ToastModule, ProgressSpinnerModule, TagModule, SkeletonModule, ThemeToggleComponent, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './track-order.component.html',
  styleUrls: ['./track-order.component.scss']
})
export class TrackOrderComponent {
  orderId = '';
  order = signal<Order | null>(null);
  loading = signal<boolean>(false);
  events: any[];

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
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

    // Check if input looks like a phone number (contains only digits, possibly with +88 prefix)
    const cleanPhone = this.orderId.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
    const isPhone = /^(\+?88)?0?1[3-9]\d{8}$/.test(cleanPhone);

    if (isPhone) {
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

            this.resolveProductNames(sorted[0]).subscribe(resolvedOrder => {
              this.order.set(resolvedOrder);
              this.loading.set(false);
            });
          } else {
            this.messageService.add({
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
            severity: 'error',
            summary: 'Error',
            detail: err.error?.detail || 'Failed to track order by phone number'
          });
        }
      });
    } else {
      // Assume it's an Order ID
      this.orderService.getOrderById(this.orderId).subscribe({
        next: (order) => {
          if (order) {
            this.resolveProductNames(order).subscribe(resolvedOrder => {
              this.order.set(resolvedOrder);
              this.loading.set(false);
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Not Found',
              detail: 'Order not found'
            });
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error('Order ID tracking error:', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Not Found',
            detail: 'Order not found'
          });
        }
      });
    }
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
    const currentOrder = this.order();
    if (!currentOrder || !currentOrder.id) return;

    this.confirmationService.confirm({
      message: 'Are you sure you want to cancel this order?',
      header: 'Confirm Cancellation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.loading.set(true);
        this.orderService.cancelOrder(currentOrder.id!).subscribe({
          next: (updatedOrder) => {
            this.order.set(updatedOrder);
            this.loading.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Cancelled',
              detail: 'Your order has been cancelled successfully'
            });
          },
          error: (err) => {
            console.error('Cancellation error:', err);
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.detail || 'Failed to cancel order'
            });
          }
        });
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
