import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { ProductService } from '../../../services/product.service';
import { PaymentService } from '../../../services/payment.service';
import { Order } from '../../../models/order.model';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
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
    FormsModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService],
  templateUrl: './orders.component.html',
  standalone: true,
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders = signal<Order[]>([]);
  totalRecords = signal<number>(0); // Initialize to 0, will grow as we fetch
  loading = signal<boolean>(false);
  selectedOrder: Order | null = null;
  displayOrderDialog = false;
  loadingDetails = false;
  lastLazyLoadEvent: TableLazyLoadEvent | null = null;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private paymentService: PaymentService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadOrders();
    this.orderService.newOrderNotification$.subscribe(() => {
      this.loadOrders();
    });
  }

  // Data Buffering
  ordersBuffer: Order[] = [];
  readonly BUFFER_SIZE = 100;

  loadOrders(event?: TableLazyLoadEvent) {
    this.loading.set(true);

    // Check if event is provided, otherwise use default or last event
    const lazyEvent = event || this.lastLazyLoadEvent || { first: 0, rows: 10 };
    this.lastLazyLoadEvent = lazyEvent;

    const first = lazyEvent.first || 0;
    const rows = lazyEvent.rows || 10;

    // Check if we have data in buffer
    // We need to check if the range [first, first + rows] is fully covered in buffer
    let dataMissing = false;
    for (let i = first; i < first + rows; i++) {
      if (!this.ordersBuffer[i]) {
        dataMissing = true;
        break;
      }
    }

    if (!dataMissing) {
      // Data exists in buffer, serve it immediately
      // Check bounds to avoid slicing beyond buffer length if total is known/capped
      const end = Math.min(first + rows, this.ordersBuffer.length);
      // If we happen to request past the buffer length (e.g. end of list), we gracefully return what we have
      const pageData = this.ordersBuffer.slice(first, end);

      // Sort if needed (since buffer might be populated in chunks, local sort of the page is good practice)
      pageData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

      this.orders.set(pageData);
      this.loading.set(false);
      return;
    }

    // Data missing, fetch a chunk
    // Align fetch to BUFFER_SIZE boundaries
    // e.g. if request is 25, we fetch 0-100. If request is 110, we fetch 100-200.
    const chunkStart = Math.floor(first / this.BUFFER_SIZE) * this.BUFFER_SIZE;

    this.orderService.getOrders(chunkStart, this.BUFFER_SIZE).subscribe({
      next: (orders) => {
        // Populate buffer
        orders.forEach((order, index) => {
          this.ordersBuffer[chunkStart + index] = order;
        });

        // Update Total Records (Pseudo-Infinite)
        // If we received a full chunk, valid total is at least chunkStart + chunkLength + 1
        // If partial chunk, we found the end.
        const currentTotal = chunkStart + orders.length;
        if (orders.length === this.BUFFER_SIZE) {
          // We allow scrolling further
          this.totalRecords.set(currentTotal + 1);
          // Ideally +1 or maybe +BUFFER_SIZE to hint more? +1 is safer for "Next" button.
        } else {
          // End of data reached
          this.totalRecords.set(currentTotal);
        }

        // Slice and serve the requested page from the now-populated buffer
        const end = Math.min(first + rows, this.ordersBuffer.length);
        const pageData = this.ordersBuffer.slice(first, end);

        pageData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

        this.orders.set(pageData);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading orders in component:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load orders.'
        });
        this.loading.set(false);
      }
    });
  }

  refreshOrders() {
    // Clear buffer to force fresh fetch
    this.ordersBuffer = [];
    this.totalRecords.set(0);

    // Reset to first page
    const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
    this.loadOrders(event);
  }

  viewOrder(order: Order) {
    this.selectedOrder = JSON.parse(JSON.stringify(order));
    this.displayOrderDialog = true;
    this.loadingDetails = true;

    // Fetch fresh order details from backend to get latest payment info
    this.orderService.getOrderById(order.id!).subscribe({
      next: (fullOrder) => {
        if (fullOrder) {
          this.selectedOrder = fullOrder;
        }
        this.fetchMissingProductDetails();
      },
      error: (err) => {
        console.error('Failed to fetch full order details', err);
        // Fallback to existing data if fetch fails, but still try loading product names
        this.fetchMissingProductDetails();
      }
    });
  }

  fetchMissingProductDetails() {
    if (!this.selectedOrder) {
      this.loadingDetails = false;
      return;
    }

    const itemsToFetch = this.selectedOrder.items.filter(item => !item.product.name || item.product.name === '');

    if (itemsToFetch.length === 0) {
      this.loadingDetails = false;
      return;
    }

    const requests = itemsToFetch.map(item => {
      // Use ID as is, or parseInt if you are sure product IDs are numbers. 
      // Assuming product IDs are numbers for now, but let's be safe.
      // If product.id is string "123", parseInt works.
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
      if (this.selectedOrder) {
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
    console.log('updateStatus called with:', status);
    const proceedWithStatusUpdate = () => {
      this.orderService.updateOrderStatus(order.id!, status as any).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: `Order ${status}` });

          // Force reload to ensure status is persisted and we get latest data
          this.refreshOrders();

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
    };

    if (status === 'Completed') {
      this.confirmationService.confirm({
        message: 'Are you sure the order is delivered to the customer?',
        header: 'Confirm Completion',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          proceedWithStatusUpdate();
        },
        reject: () => {
          // Do nothing
        }
      });
    } else {
      proceedWithStatusUpdate();
    }
  }

  adminConfirmPayment(order: Order) {
    // Use ID as is, don't force parseInt
    const orderId = order.id!;

    // Construct payload for verification
    const verifyPayload = {
      id: order.paymentId || 0,
      order_id: typeof orderId === 'string' ? parseInt(orderId, 10) : orderId,
      status: 'paid', // Explicitly set status to paid
      transaction_id: order.transactionId || '',
      payment_method: order.paymentMethod ? order.paymentMethod.toLowerCase() : 'bkash'
    };

    // Use specific verify endpoint for bKash (or general admin verification if applicable to all)
    // The user specifically mentioned this for bKash
    if (order.paymentMethod?.toLowerCase() === 'bkash') {
      this.paymentService.verifyPayment(orderId, verifyPayload).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated' });

          // Use status from backend response or default to Paid
          let newPaymentStatus = res.status || 'Paid';

          // Simple formatting if needed (e.g. "bkash_confirmed" -> "Bkash_confirmed")
          // But ideally we trust the backend string as requested.
          // If backend sends "Bkash Confirmed", we use it.

          // Update modal
          if (this.selectedOrder && this.selectedOrder.id === order.id) {
            this.selectedOrder.paymentStatus = newPaymentStatus;
          }

          // Update list locally to avoid stale data from immediate reload
          this.orders.update(currentOrders => currentOrders.map(o =>
            o.id === order.id ? { ...o, paymentStatus: newPaymentStatus } : o
          ));

          // Also confirm the order status if it's still pending
          if (order.status === 'Pending') {
            this.updateStatus(order, 'Confirmed');
          }
        },
        error: (err) => {
          console.error('Admin payment verification failed', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to verify payment' });
        }
      });
    } else {
      // Fallback for COD or others if needed
      this.paymentService.verifyPayment(orderId, verifyPayload).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated' });

          const newStatus = res.status || 'Paid';

          // Update modal
          if (this.selectedOrder && this.selectedOrder.id === order.id) {
            this.selectedOrder.paymentStatus = newStatus;
          }

          // Update list locally
          this.orders.update(currentOrders => currentOrders.map(o =>
            o.id === order.id ? { ...o, paymentStatus: newStatus } : o
          ));

          // Also confirm the order status if it's still pending
          if (order.status === 'Pending') {
            this.updateStatus(order, 'Confirmed');
          }
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

  getPaymentSeverity(status: string | undefined): 'success' | 'warning' | 'danger' | 'info' {
    if (!status) return 'warning';
    const s = status.toLowerCase();
    // Removed 'submitted' from success list so it defaults to warning
    if (s.includes('paid') || s.includes('confirmed') || s.includes('complete') || s.includes('verified')) {
      return 'success';
    }
    return 'warning';
  }

  isPaymentConfirmed(status: string | undefined): boolean {
    if (!status) return false;
    const s = status.toLowerCase();
    // Removed 'submitted' from confirmed list so the button appears
    return s.includes('paid') || s.includes('confirmed') || s.includes('complete') || s.includes('verified');
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
