import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
    selector: 'app-invoice',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './invoice.component.html',
    styleUrls: ['./invoice.component.scss']
})
export class InvoiceComponent {
    @Input() orderedItems: any[] = [];
    @Input() orderFormSnapshot: any = {};
    @Input() orderPaymentMethod: string = '';
    @Input() orderDeliveryCharge: number = 0;
    @Input() orderTotal: number = 0;
    @Input() placedOrderId: string = '';

    @Output() continueShoppingClick = new EventEmitter<void>();

    @ViewChild('invoiceArea', { static: false }) invoiceArea!: ElementRef;

    today = new Date();

    get invoiceNumber(): string {
        const year = this.today.getFullYear();
        const id = (this.placedOrderId || '0').padStart(5, '0');
        return `INV-${year}-${id}`;
    }

    get formattedDate(): string {
        return this.today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    get formattedTime(): string {
        return this.today.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    get paymentMethodDisplay(): string {
        const m = (this.orderPaymentMethod || '').toLowerCase();
        if (m.includes('bkash')) return 'bKash';
        return 'Cash on Delivery';
    }

    get paymentStatus(): string {
        const m = (this.orderPaymentMethod || '').toLowerCase();
        if (m.includes('bkash')) return 'Paid';
        return 'Unpaid';
    }

    get subtotal(): number {
        if (!this.orderedItems || this.orderedItems.length === 0) return 0;
        return this.orderedItems.reduce((sum: number, item: any) => {
            const price = item.product?.price || 0;
            const qty = item.quantity || 0;
            return sum + (price * qty);
        }, 0);
    }

    get discount(): number {
        const computed = this.subtotal + this.orderDeliveryCharge;
        if (this.orderTotal < computed) {
            return computed - this.orderTotal;
        }
        return 0;
    }

    get grandTotal(): number {
        return this.orderTotal || (this.subtotal + this.orderDeliveryCharge - this.discount);
    }

    continueShopping(): void {
        this.continueShoppingClick.emit();
    }

    async downloadReceipt(): Promise<void> {
        const el = this.invoiceArea?.nativeElement;
        if (!el) return;

        const canvas = await html2canvas(el, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const pdfWidth = 210;
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [pdfWidth, Math.max(pdfHeight, 297)],
            compress: false
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'NONE');
        pdf.save(`Invoice-${this.invoiceNumber}.pdf`);
    }
}
