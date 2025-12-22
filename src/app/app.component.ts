import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrderService } from './services/order.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule],
  providers: [MessageService],
  template: `
    <router-outlet></router-outlet>
    <p-toast position="top-right"></p-toast>
  `
})
export class AppComponent implements OnInit {
  title = 'karukolpo-frontend';

  constructor(
    private orderService: OrderService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.orderService.newOrderNotification$.subscribe(orderId => {
      this.messageService.add({
        severity: 'info',
        summary: 'New Order Placed',
        detail: `Order ID: ${orderId} has been created.`,
        life: 5000
      });
    });
  }
}
