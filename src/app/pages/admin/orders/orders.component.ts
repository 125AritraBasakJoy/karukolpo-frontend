import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, ToastModule, DialogModule, ProgressSpinnerModule, NotificationButtonComponent],
  providers: [MessageService],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders = signal<Order[]>([]);
  loading = signal<boolean>(false);
  selectedOrder: Order | null = null;
  displayOrderDialog = false;

  constructor(
    private orderService: OrderService,
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
    this.selectedOrder = order;
    this.displayOrderDialog = true;
  }

  togglePaymentStatus(order: Order) {
    const newStatus = order.paymentStatus === 'Paid' ? 'Pending' : 'Paid';
    const method = order.paymentMethod || 'COD'; // Default to COD if not set

    this.orderService.updateOrderPayment(order.id!, method, newStatus).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Updated',
        detail: `Payment status set to ${newStatus}`
      });
      this.loadOrders();

      // Update local state if dialog is open
      if (this.selectedOrder && this.selectedOrder.id === order.id) {
        this.selectedOrder.paymentStatus = newStatus;
      }
    });
  }

  updateStatus(order: Order, status: 'Approved' | 'Delivered' | 'Completed' | 'Deleted') {
    if (status === 'Deleted') {
      // In a real app, you might want to confirm deletion
    }

    this.orderService.updateOrderStatus(order.id!, status).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Order ${status}` });
      this.loadOrders();
      if (this.selectedOrder && this.selectedOrder.id === order.id) {
        this.selectedOrder.status = status;
      }
    });
  }

  getSeverity(status: string) {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Delivered':
        return 'info';
      case 'Pending':
        return 'warning';
      case 'Completed':
        return 'info';
      case 'Deleted':
        return 'danger';
      default:
        return 'info'; // Changed from 'text' to 'info' as 'text' is not a valid severity for p-tag
    }
  }

  downloadOrders() {
    const orders = this.orders();
    if (orders.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No Data', detail: 'No orders to export' });
      return;
    }

    // Format Data for Excel
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

    // Generate Worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Auto-width columns (basic check)
    const wscols = [
      { wch: 15 }, // ID
      { wch: 20 }, // Name
      { wch: 15 }, // Phone
      { wch: 15 }, // District
      { wch: 12 }, // Date
      { wch: 12 }, // Total
      { wch: 15 }, // Pay Status
      { wch: 15 }  // Order Status
    ];
    ws['!cols'] = wscols;

    // Generate Workbook
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    // Save File
    XLSX.writeFile(wb, 'orders_export.xlsx');
  }
}
