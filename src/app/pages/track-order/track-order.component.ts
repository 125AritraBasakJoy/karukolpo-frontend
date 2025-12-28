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

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TimelineModule, ToastModule, ProgressSpinnerModule, TagModule, SkeletonModule],
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
      { status: 'Approved', icon: 'pi pi-cog', color: '#673AB7' },
      { status: 'Completed', icon: 'pi pi-check', color: '#FF9800' },
      { status: 'Delivered', icon: 'pi pi-check', color: '#607D8B' }
    ];
  }

  trackOrder() {
    if (!this.orderId) return;

    this.loading.set(true);
    this.order.set(null); // Clear previous result while loading

    // Simulate small delay for better UX if search is instantaneous
    setTimeout(() => {
      this.orderService.getOrderById(this.orderId).subscribe(order => {
        if (order) {
          this.order.set(order);
          this.loading.set(false);
        } else {
          // Fallback: Try tracking by Phone Number
          this.orderService.getOrderByPhone(this.orderId).subscribe(orderByPhone => {
            if (orderByPhone) {
              this.order.set(orderByPhone);
            } else {
              this.order.set(null);
              this.messageService.add({ severity: 'error', summary: 'Not Found', detail: 'Order not found' });
            }
            this.loading.set(false);
          });
        }
      });
    }, 500);
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
