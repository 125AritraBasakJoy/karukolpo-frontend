import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    // ========================
    //  PDF Generation (jsPDF + AutoTable)
    //  Non-blocking — no DOM capture
    // ========================

    /** Load an image from a URL and return its base64 data URL + dimensions */
    private loadImageAsBase64(url: string): Promise<{ data: string; width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                resolve({
                    data: canvas.toDataURL('image/png', 1),
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = () => reject(new Error('Failed to load logo image'));
            img.src = url;
        });
    }

    async downloadReceipt(): Promise<void> {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();    // 210
        const margin = 20;
        const contentW = pageW - margin * 2;               // 170
        let y = 12; // current Y cursor — starts higher for logo

        // ---- Colors ----
        const darkNavy: [number, number, number] = [30, 41, 59];       // #1e293b
        const midGray: [number, number, number] = [100, 116, 139];     // #64748b
        const lightGray: [number, number, number] = [148, 163, 184];   // #94a3b8
        const black: [number, number, number] = [15, 23, 42];          // #0f172a
        const blue: [number, number, number] = [37, 99, 235];          // #2563eb
        const green: [number, number, number] = [22, 163, 74];         // #16a34a
        const red: [number, number, number] = [220, 38, 38];           // #dc2626
        const tableBg: [number, number, number] = [241, 245, 249];     // #f1f5f9
        const borderColor: [number, number, number] = [226, 232, 240]; // #e2e8f0

        // ---- Helper: draw text ----
        const text = (
            str: string, x: number, yPos: number,
            opts: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right'; maxW?: number } = {}
        ) => {
            pdf.setFontSize(opts.size || 10);
            pdf.setTextColor(...(opts.color || black));
            pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
            pdf.text(str, x, yPos, { align: opts.align || 'left', maxWidth: opts.maxW });
        };

        // ---- Helper: horizontal line ----
        const hLine = (yPos: number, color: [number, number, number] = borderColor, width = 0.5) => {
            pdf.setDrawColor(...color);
            pdf.setLineWidth(width);
            pdf.line(margin, yPos, pageW - margin, yPos);
        };

        // =====================
        //  LOGO (top-left)
        // =====================
        try {
            const logo = await this.loadImageAsBase64('assets/invoice-logo-mandala.jpg');
            const logoH = 22; // desired height in mm
            const logoW = (logo.width / logo.height) * logoH; // maintain aspect ratio
            pdf.addImage(logo.data, 'JPEG', margin, y, logoW, logoH);
        } catch (e) {
            console.warn('Could not load logo for PDF:', e);
        }

        // =====================
        //  HEADER: Invoice No + Order ID (right side)
        // =====================
        text('INVOICE NO', pageW - margin, y, { size: 7, color: midGray, align: 'right' });
        y += 5;
        text(this.invoiceNumber, pageW - margin, y, { size: 14, color: darkNavy, bold: true, align: 'right' });
        y += 6;
        text('ORDER ID', pageW - margin, y, { size: 7, color: midGray, align: 'right' });
        y += 5;
        text(`#${this.placedOrderId}`, pageW - margin, y, { size: 16, color: darkNavy, bold: true, align: 'right' });

        // =====================
        //  TITLE: INVOICE (positioned below the logo)
        // =====================
        y = 50;
        text('INVOICE', margin, y, { size: 28, color: black, bold: true });
        y += 6;
        hLine(y, borderColor, 0.8);
        y += 8;

        // =====================
        //  DATE / PAYMENT ROW
        // =====================
        text('DATE ISSUED:', margin, y, { size: 7, color: lightGray });
        text(this.formattedDate, margin + 22, y, { size: 10, color: black, bold: true });

        text('PAYMENT METHOD:', pageW - margin - 65, y, { size: 7, color: lightGray });
        text(this.paymentMethodDisplay, pageW - margin, y, { size: 10, color: blue, bold: true, align: 'right' });

        y += 6;
        text('ORDER TIME:', margin, y, { size: 7, color: lightGray });
        text(this.formattedTime, margin + 22, y, { size: 10, color: black, bold: true });

        text('PAYMENT STATUS:', pageW - margin - 65, y, { size: 7, color: lightGray });
        const statusColor = this.paymentStatus === 'Paid' ? green : black;
        text(this.paymentStatus, pageW - margin, y, { size: 10, color: statusColor, bold: true, align: 'right' });
        y += 10;

        // =====================
        //  THREE ADDRESS CARDS
        // =====================
        const cardW = (contentW - 8) / 3; // 3 cards with 4mm gaps
        const cardX = [margin, margin + cardW + 4, margin + (cardW + 4) * 2];
        const cardH = 45;
        const headerH = 7;

        // Draw card backgrounds and headers
        for (let i = 0; i < 3; i++) {
            // Border
            pdf.setDrawColor(...borderColor);
            pdf.setLineWidth(0.4);
            pdf.roundedRect(cardX[i], y, cardW, cardH, 1.5, 1.5, 'S');

            // Header bar
            pdf.setFillColor(...darkNavy);
            // Top rounded rect for header (clip with rect)
            pdf.rect(cardX[i], y, cardW, headerH, 'F');
            // Round only top corners by drawing over bottom of header
        }

        const headers = ['SELLER', 'BILL TO', 'SHIPPING ADDRESS'];
        for (let i = 0; i < 3; i++) {
            text(headers[i], cardX[i] + 4, y + 5, { size: 7, color: [255, 255, 255], bold: true });
        }

        // Card body content
        const bodyY = y + headerH + 5;

        // Seller
        text('Karukolpo', cardX[0] + 4, bodyY, { size: 9, color: black, bold: true });
        text('Pathrail, Tangail-1912,', cardX[0] + 4, bodyY + 5, { size: 8, color: midGray });
        text('Bangladesh.', cardX[0] + 4, bodyY + 9, { size: 8, color: midGray });
        text('Dhaka, Bangladesh', cardX[0] + 4, bodyY + 13, { size: 8, color: midGray });
        text('Phone: 01675-718846', cardX[0] + 4, bodyY + 20, { size: 8, color: midGray });
        text('Email: support@karukolpo.com', cardX[0] + 4, bodyY + 24, { size: 8, color: midGray });

        // Bill To
        const custName = this.orderFormSnapshot.fullName || '—';
        const custPhone = this.orderFormSnapshot.phoneNumber || '';
        const custEmail = this.orderFormSnapshot.email || '';
        text(custName, cardX[1] + 4, bodyY, { size: 9, color: black, bold: true });
        if (custPhone) text(`Phone: ${custPhone}`, cardX[1] + 4, bodyY + 5, { size: 8, color: midGray });
        if (custEmail) text(`Email: ${custEmail}`, cardX[1] + 4, bodyY + 10, { size: 8, color: midGray, maxW: cardW - 8 });

        // Shipping Address
        const addr = this.orderFormSnapshot.fullAddress || '—';
        const subDist = this.orderFormSnapshot.subDistrict || '';
        const dist = this.orderFormSnapshot.district || '';
        const postal = this.orderFormSnapshot.postalCode || '';
        const addrLines = pdf.splitTextToSize(addr, cardW - 8);
        let addrY = bodyY;
        addrLines.forEach((line: string) => {
            text(line, cardX[2] + 4, addrY, { size: 8, color: midGray });
            addrY += 4;
        });
        if (subDist) { text(subDist, cardX[2] + 4, addrY, { size: 8, color: midGray }); addrY += 4; }
        if (dist) { text(dist, cardX[2] + 4, addrY, { size: 8, color: midGray }); addrY += 4; }
        if (postal) { text(`Postal Code: ${postal}`, cardX[2] + 4, addrY, { size: 8, color: midGray }); }

        y += cardH + 8;

        // =====================
        //  PRODUCTS TABLE (AutoTable)
        // =====================
        const tableBody = (this.orderedItems || []).map((item: any) => {
            const name = item.product?.name || 'Product';
            const qty = item.quantity || 0;
            const price = item.product?.price || 0;
            const lineTotal = price * qty;
            return [name, qty.toString(), `BDT ${price.toLocaleString()}`, `BDT ${lineTotal.toLocaleString()}`];
        });

        autoTable(pdf, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['PRODUCT NAME', 'QTY', 'UNIT PRICE', 'LINE TOTAL']],
            body: tableBody,
            styles: {
                fontSize: 9,
                cellPadding: 4,
                textColor: [51, 65, 85],
                lineColor: tableBg,
                lineWidth: 0.3
            },
            headStyles: {
                fillColor: tableBg,
                textColor: [71, 85, 105],
                fontStyle: 'bold',
                fontSize: 7,
                cellPadding: 3,
                halign: 'left'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'center', cellWidth: 25 },
                2: { halign: 'center', cellWidth: 35 },
                3: { halign: 'center', cellWidth: 35 }
            },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            theme: 'grid'
        });

        y = (pdf as any).lastAutoTable.finalY + 10;

        // =====================
        //  FOOTER: Notes + Totals
        // =====================
        const notesX = margin;
        const totalsX = margin + contentW - 70;
        const totalsW = 70;

        // Notes
        text('NOTES:', notesX, y, { size: 7, color: lightGray, bold: true });
        const notes = [
            '• This is a system-generated invoice.',
            '• No signature required.',
            '• For support, contact support@karukolpo.com'
        ];
        notes.forEach((note, i) => {
            text(note, notesX, y + 5 + (i * 4.5), { size: 8, color: midGray });
        });

        // Totals
        const totRow = (label: string, value: string, yPos: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
            text(label, totalsX, yPos, { size: 9, color: opts.color || midGray });
            text(value, totalsX + totalsW, yPos, { size: 9, color: opts.color || midGray, align: 'right', bold: opts.bold });
        };

        totRow('Subtotal:', `BDT ${this.subtotal.toLocaleString()}`, y);
        totRow('Delivery Fee:', `BDT ${this.orderDeliveryCharge.toLocaleString()}`, y + 6);

        // Grand Total
        y += 16;
        hLine(y, borderColor, 0.8);
        y += 7;

        text('GRAND TOTAL', totalsX, y, { size: 13, color: darkNavy, bold: true });
        text(`BDT ${this.grandTotal.toLocaleString()}`, totalsX + totalsW, y, { size: 20, color: darkNavy, bold: true, align: 'right' });

        // Amount Due Box
        y += 12;
        const boxX = totalsX - 5;
        const boxW = totalsW + 10;
        const boxH = 18;
        pdf.setDrawColor(...darkNavy);
        pdf.setLineWidth(0.6);
        pdf.roundedRect(boxX, y, boxW, boxH, 2, 2, 'S');

        text('AMOUNT DUE', boxX + boxW / 2, y + 6, { size: 7, color: lightGray, align: 'center' });
        const amountDue = this.paymentStatus === 'Paid' ? 0 : this.grandTotal;
        text(`BDT ${amountDue.toLocaleString()}`, boxX + boxW / 2, y + 13, { size: 16, color: blue, bold: true, align: 'center' });

        // =====================
        //  SAVE
        // =====================
        pdf.save(`Invoice-${this.invoiceNumber}.pdf`);
    }
}
