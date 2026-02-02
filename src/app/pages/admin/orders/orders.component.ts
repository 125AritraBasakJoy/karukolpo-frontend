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
  standalone: true,
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
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders = signal<Order[]>([]);
  loading = signal<boolean>(false);
  selectedOrder: Order | null = null;
  displayOrderDialog = false;
  loadingDetails = false;

  // Payment Confirmation
  displayPaymentConfirmDialog = false;
  transactionId = '';
  orderToConfirm: Order | null = null;

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

  togglePaymentStatus(order: Order) {
    if (order.paymentStatus === 'Paid') {
      this.messageService.add({ severity: 'info', summary: 'Already Paid', detail: 'Payment is already confirmed.' });
      return;
    }

    if (!order.paymentId) {
      this.messageService.add({ severity: 'warn', summary: 'No Payment Record', detail: 'This order has no payment record to confirm.' });
      return;
    }

    this.orderToConfirm = order;
    this.transactionId = '';
    this.displayPaymentConfirmDialog = true;
  }

  confirmPayment() {
    if (!this.transactionId) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Transaction ID is required' });
      return;
    }

    if (!this.orderToConfirm || !this.orderToConfirm.paymentId) return;

    const orderId = parseInt(this.orderToConfirm.id!, 10);
    const paymentId = this.orderToConfirm.paymentId;

    this.paymentService.confirmPayment(orderId, paymentId, this.transactionId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Payment Confirmed' });
        this.displayPaymentConfirmDialog = false;
        this.loadOrders(); // Refresh to see updated status
        
        // Update local state if dialog is open
        if (this.selectedOrder && this.selectedOrder.id === this.orderToConfirm?.id) {
          this.selectedOrder.paymentStatus = 'Paid';
        }
      },
      error: (err) => {
        console.error('Payment confirmation failed', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to confirm payment' });
      }
    });
  }

  updateStatus(order: Order, status: 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled') {
    if (status === 'Cancelled' || status === 'Confirmed') {
      this.orderService.updateOrderStatus(order.id!, status).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Order ${status}` });
        this.loadOrders();
        if (this.selectedOrder && this.selectedOrder.id === order.id) {
          this.selectedOrder.status = status;
        }
      });
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Not Supported', detail: 'Only confirmation and cancellation are supported via API currently.' });
    }
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
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
