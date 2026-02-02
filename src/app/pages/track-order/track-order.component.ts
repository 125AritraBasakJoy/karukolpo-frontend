import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TimelineModule, ToastModule, ProgressSpinnerModule, TagModule, SkeletonModule, ThemeToggleComponent],
  providers: [MessageService],
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

      console.log('Tracking by phone:', normalizedPhone);

      this.orderService.trackOrdersByPhone(normalizedPhone).subscribe({
        next: (orders) => {
          if (orders && orders.length > 0) {
            // Sort by date descending and get the most recent order
            const sorted = orders.sort((a, b) =>
              new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
            );
            this.order.set(sorted[0]);
          } else {
            this.messageService.add({
              severity: 'info',
              summary: 'Not Found',
              detail: 'No orders found for this phone number'
            });
          }
          this.loading.set(false);
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
            this.order.set(order);
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Not Found',
              detail: 'Order not found'
            });
          }
          this.loading.set(false);
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

  goBack() {
    this.router.navigate(['/']);
  }
}
