import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { ProductService } from '../../../services/product.service';
import { PaymentService } from '../../../services/payment.service';
import { Order } from '../../../models/order.model';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-orders',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    DialogModule,
    ProgressSpinnerModule,
    NotificationButtonComponent,
    SkeletonModule,
    TooltipModule,
    InputTextModule,
    FormsModule
  ],
  providers: [MessageService],
  templateUrl: './orders.component.html',
  standalone: true,
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders = signal<Order[]>([]);
  loading = signal<boolean>(false);
  selectedOrder: Order | null = null;
  displayOrderDialog = false;
  loadingDetails = false;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private paymentService: PaymentService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.loadOrders();
    this.orderService.newOrderNotification$.subscribe(() => {
      this.loadOrders();
    });
  }

  loadOrders() {
    this.loading.set(true);
    this.orderService.getOrders().subscribe({
      next: (orders) => {
        // Sort by date descending
        const sortedOrders = orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        this.orders.set(sortedOrders);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  refreshOrders() {
    this.loading.set(true);
    this.orderService.reloadOrders().subscribe({
      next: (orders) => {
        // Sort by date descending
        const sortedOrders = orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        this.orders.set(sortedOrders);
        this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Orders list updated' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  viewOrder(order: Order) {
    console.log('Viewing order:', order);
    this.selectedOrder = JSON.parse(JSON.stringify(order));
    this.displayOrderDialog = true;
    this.loadingDetails = true;

    const itemsToFetch = this.selectedOrder!.items.filter(item => !item.product.name || item.product.name === '');

    if (itemsToFetch.length === 0) {
      this.loadingDetails = false;
      return;
    }

    const requests = itemsToFetch.map(item => {
      const productId = parseInt(item.product.id, 10);
      return this.productService.getProductById(productId).pipe(
        map(product => ({ item, product })),
        catchError(err => {
          console.error(`Failed to fetch product ${productId}`, err);
          return of({ item, product: null });
        })
      );
    });

    forkJoin(requests).subscribe(results => {
      if (this.selectedOrder && this.selectedOrder.id === order.id) {
        const updatedItems = this.selectedOrder.items.map(currentItem => {
          const result = results.find(r => r.item.product.id === currentItem.product.id);
          if (result && result.product) {
            return {
              ...currentItem,
              product: {
                ...currentItem.product,
                name: result.product.name,
                imageUrl: result.product.imageUrl,
                code: result.product.code
              }
            };
          } else if (result) {
            return {
              ...currentItem,
              product: {
                ...currentItem.product,
                name: 'Unknown Product (Deleted)'
              }
            };
          }
          return currentItem;
        });

        this.selectedOrder = {
          ...this.selectedOrder,
          items: updatedItems
        };
      }
      this.loadingDetails = false;
    });
  }

  updateStatus(order: Order, status: 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled' | 'Completed') {
    this.orderService.updateOrderStatus(order.id!, status as any).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Order ${status}` });
        
        // Update local state
        this.orders.update(currentOrders => currentOrders.map(o => 
          o.id === order.id ? { ...o, status: status } : o
        ));
        
        if (this.selectedOrder && this.selectedOrder.id === order.id) {
          this.selectedOrder.status = status;
        }
      },
      error: (err) => {
        console.error(`Failed to update order status to ${status}`, err);
        const errorMsg = err.error?.detail || 'Failed to update order status.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: errorMsg });
      }
    });
  }

  adminConfirmPayment(order: Order) {
    console.log('adminConfirmPayment called for order:', order);
    // window.alert('Debugging: adminConfirmPayment called'); 

    const orderId = parseInt(order.id!, 10);
    console.log('Payment Method:', order.paymentMethod);

    // Use specific verify endpoint for bKash (or general admin verification if applicable to all)
    // The user specifically mentioned this for bKash
    if (order.paymentMethod?.toLowerCase() === 'bkash') {
      console.log('Calling verifyPayment...');
      this.paymentService.verifyPayment(orderId).subscribe({
        next: (res) => {
          console.log('Verify Success:', res);
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated to Bkash Confirmed' });
          
          const newPaymentStatus = 'Bkash Confirmed';
          
          // Update modal
          if (this.selectedOrder && this.selectedOrder.id === order.id) {
            this.selectedOrder.paymentStatus = newPaymentStatus;
          }
          
          // Update list locally to avoid stale data from immediate reload
          this.orders.update(currentOrders => currentOrders.map(o => 
            o.id === order.id ? { ...o, paymentStatus: newPaymentStatus } : o
          ));
        },
        error: (err) => {
          console.error('Admin payment verification failed', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to verify payment' });
        }
      });
    } else {
      console.log('Else block (not bkash or mismatched case):', order.paymentMethod);
      // Fallback for COD or others if needed
      this.paymentService.verifyPayment(orderId).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated to Paid' });
          
          const newStatus = 'Paid';

          // Update modal
          if (this.selectedOrder && this.selectedOrder.id === order.id) {
            this.selectedOrder.paymentStatus = newStatus;
          }

          // Update list locally
          this.orders.update(currentOrders => currentOrders.map(o => 
            o.id === order.id ? { ...o, paymentStatus: newStatus } : o
          ));
        },
        error: (err) => {
          console.error('Admin payment verification failed', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to verify payment' });
        }
      });
    }
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (status) {
      case 'Confirmed':
        return 'info'; // Changed to info to distinguish from Completed
      case 'Completed':
        return 'success'; // Completed is green
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

  downloadOrders() {
    const orders = this.orders();
    if (orders.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No Data', detail: 'No orders to export' });
      return;
    }

    const data = orders.map(order => ({
      'Order ID': order.id,
      'Customer Name': order.fullName,
      'Phone': order.phoneNumber,
      'District': order.district,
      'Date': new Date(order.orderDate).toLocaleDateString(),
      'Total Amount': order.totalAmount,
      'Payment Status': order.paymentStatus || 'Pending',
      'Order Status': order.status
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wscols = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'orders_export.xlsx');
  }
}
