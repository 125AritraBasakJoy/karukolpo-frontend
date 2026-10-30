import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { THERMAL_LOGO_BASE64 } from '../thermal-invoice/thermal-logo.constant';
import { formatPaymentStatus, PaymentStatusInfo } from '../../models/payment.model';

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
    @Input() orderDiscount: number = 0;
    @Input() placedOrderId: string = '';
    @Input() placedOrderNumber: string = '';
    @Input() paymentStatus?: string;
    @Input() amountDue: number = 0;
    @Input() createdAt?: string | Date;

    @Output() continueShoppingClick = new EventEmitter<void>();

    today = new Date();

    get orderDate(): Date {
        if (this.createdAt) {
            const d = new Date(this.createdAt);
            if (!isNaN(d.getTime())) return d;
        }
        return this.today;
    }

    get invoiceNumber(): string {
        const year = this.orderDate.getFullYear();
        // Use orderNumber if available, otherwise fallback to id
        const idPart = (this.placedOrderNumber || this.placedOrderId || '0').slice(-5);
        return `INV-${year}-${idPart}`;
    }

    get formattedDate(): string {
        return this.orderDate.toLocaleDateString('en-US', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    get formattedTime(): string {
        return this.orderDate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    get paymentMethodDisplay(): string {
        const m = (this.orderPaymentMethod || '').toLowerCase();
        if (m.includes('bkash')) return 'bKash';
        if (m.includes('cod') || m.includes('cash on delivery')) return 'Cash on Delivery';
        return this.orderPaymentMethod || 'Cash on Delivery';
    }

    get paymentStatusInfo(): PaymentStatusInfo {
        const raw = (this.paymentStatus || '').toLowerCase().trim();
        if (raw) {
            switch (raw) {
                case 'paid':
                    return { label: 'Paid', severity: 'success', rawStatus: 'paid' };
                case 'partially_paid':
                    return { label: 'Partially Paid', severity: 'warn', rawStatus: 'partially_paid' };
                case 'awaiting_verification':
                    return { label: 'Awaiting Verification', severity: 'info', rawStatus: 'awaiting_verification' };
                case 'refund_due':
                    return { label: 'Refund Pending', severity: 'danger', rawStatus: 'refund_due' };
                case 'refunded':
                    return { label: 'Refunded', severity: 'secondary', rawStatus: 'refunded' };
                case 'void':
                    return { label: 'Cancelled', severity: 'secondary', rawStatus: 'void' };
                case 'unpaid':
                default:
                    return { label: 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
            }
        }
        const m = (this.orderPaymentMethod || '').toLowerCase();
        if (m.includes('bkash')) {
            return { label: 'Paid', severity: 'success', rawStatus: 'paid' };
        }
        return { label: 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
    }

    get paymentStatusDisplay(): string {
        return this.paymentStatusInfo.label;
    }

    get subtotal(): number {
        if (!this.orderedItems || this.orderedItems.length === 0) return 0;
        return this.orderedItems.reduce((sum: number, item: any) => {
            const price = item.price_at_purchase ?? item.price ?? item.product?.effective_price ?? item.product?.price ?? 0;
            const qty = item.quantity || 0;
            return sum + (price * qty);
        }, 0);
    }

    get discount(): number {
        if (this.orderDiscount > 0) return this.orderDiscount;
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

    /** Helper to render Bengali/Unicode text as a high-quality data URL via Browser Canvas with word-wrapping */
    private renderTextAsImage(
        text: string,
        options: { fontSize: number; color: string; bold?: boolean; maxWidthMm?: number }
    ): { data: string; wMm: number; hMm: number } {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // 1mm = 3.7795 px at 96 DPI
        // 4x scale factor for sharp print-quality PDF rasterization
        const scale = 4;
        const mmToPx = 3.7795 * scale;

        // Font size: in pt. pt to px is pt * (96 / 72) = pt * 1.333
        const fontSizePx = Math.round(options.fontSize * 1.333 * scale);
        const lineHeightPx = Math.round(fontSizePx * 1.45);
        const fontStr = `${options.bold ? 'bold' : 'normal'} ${fontSizePx}px "Noto Sans Bengali", "Hind Siliguri", "Inter", sans-serif`;
        ctx.font = fontStr;

        const maxCanvasWidth = options.maxWidthMm ? options.maxWidthMm * mmToPx : 0;

        // Word wrap lines
        const words = (text || '').trim().split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        if (!maxCanvasWidth) {
            lines.push(text || '');
        } else {
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = ctx.measureText(testLine).width;

                if (testWidth > maxCanvasWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }
        }

        if (lines.length === 0) {
            lines.push('');
        }

        // Measure maximum line width among wrapped lines
        let measuredMaxLineWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > measuredMaxLineWidth) {
                measuredMaxLineWidth = w;
            }
        }

        const paddingX = Math.round(2 * scale);
        const paddingY = Math.round(2 * scale);

        canvas.width = Math.ceil(measuredMaxLineWidth + paddingX * 2);
        canvas.height = Math.ceil(lines.length * lineHeightPx + paddingY * 2);

        // Re-apply context properties after canvas resize
        ctx.font = fontStr;
        ctx.fillStyle = options.color;
        ctx.textBaseline = 'top';

        // Draw each line
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], paddingX, paddingY + (i * lineHeightPx));
        }

        const wMm = Number((canvas.width / mmToPx).toFixed(2));
        const hMm = Number((canvas.height / mmToPx).toFixed(2));

        return {
            data: canvas.toDataURL('image/png', 1.0),
            wMm,
            hMm
        };
    }

    private hasBengali(text: string): boolean {
        if (!text) return false;
        return /[\u0980-\u09FF]/.test(text);
    }

    async downloadReceipt(customData?: any): Promise<void> {
        if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
            try {
                await (document as any).fonts.ready;
            } catch (e) {
                // proceed if font loading promise fails
            }
        }

        if (customData) {
            this.orderedItems = customData.items || [];
            this.orderFormSnapshot = customData.snapshot || {};
            this.orderPaymentMethod = customData.method || '';
            this.orderDeliveryCharge = customData.deliveryCharge || 0;
            this.orderTotal = customData.total || 0;
            this.orderDiscount = customData.discount || 0;
            this.placedOrderId = customData.id || '';
            this.placedOrderNumber = customData.orderNumber || '';
            if (customData.payment_status || customData.paymentStatus) {
                this.paymentStatus = customData.payment_status || customData.paymentStatus;
            }
            if (customData.amount_due !== undefined) {
                this.amountDue = customData.amount_due;
            }
            if (customData.created_at || customData.createdAt) {
                this.createdAt = customData.created_at || customData.createdAt;
            }
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();    // 210
        const pageH = pdf.internal.pageSize.getHeight();   // 297
        const margin = 20;
        const contentW = pageW - margin * 2;               // 170
        let y = 14; // current Y cursor

        // ---- Premium Commercial E-Commerce Palette ----
        const brandPrimary: [number, number, number] = [24, 24, 27];      // #18181B (Slate Black / Primary Brand)
        const brandAccent: [number, number, number] = [184, 78, 41];      // #B84E29 (Karukolpo Terracotta Accent)
        const textPrimary: [number, number, number] = [30, 30, 36];       // #1E1E24 (Crisp High-Contrast Text)
        const textSecondary: [number, number, number] = [82, 82, 91];     // #52525B (Neutral Muted Grey)
        const textMuted: [number, number, number] = [113, 113, 122];      // #71717A (Labels & Subtitles)
        const surfaceBg: [number, number, number] = [255, 255, 255];      // Pure White Cards
        const cardHeaderBg: [number, number, number] = [244, 244, 245];   // #F4F4F5 (Clean Neutral Header)
        const tableHeadBg: [number, number, number] = [244, 244, 245];    // #F4F4F5 (Subtle Cool Grey Head)
        const tableAltBg: [number, number, number] = [250, 250, 250];     // #FAFAFA (Subtle Row Stripe)
        const borderColor: [number, number, number] = [228, 228, 231];    // #E4E4E7 (Crisp 1px Grey Border)
        const green: [number, number, number] = [22, 101, 52];            // #166534 (Confirmed Green)

        // ---- Helper: draw text ----
        const text = (
            str: string, x: number, yPos: number,
            opts: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right'; maxW?: number; font?: 'helvetica' | 'times' } = {}
        ) => {
            pdf.setFontSize(opts.size || 10);
            pdf.setTextColor(...(opts.color || textPrimary));
            pdf.setFont(opts.font || 'helvetica', opts.bold ? 'bold' : 'normal');
            pdf.text(str, x, yPos, { align: opts.align || 'left', maxWidth: opts.maxW });
        };

        // ---- Helper: horizontal line ----
        const hLine = (yPos: number, color: [number, number, number] = borderColor, width = 0.4) => {
            pdf.setDrawColor(...color);
            pdf.setLineWidth(width);
            pdf.line(margin, yPos, pageW - margin, yPos);
        };

        // =====================
        //  LOGO (top-left)
        // =====================
        try {
            const logoH = 20; // desired height in mm
            const logoW = (829 / 560) * logoH; // maintain aspect ratio
            pdf.addImage(THERMAL_LOGO_BASE64, 'JPEG', margin, y, logoW, logoH);
        } catch (e) {
            console.warn('Could not load logo for PDF:', e);
        }

        // =====================
        //  HEADER: Invoice No + Order ID (right side)
        // =====================
        text('INVOICE NO', pageW - margin, y + 1, { size: 7.5, color: textMuted, bold: true, align: 'right' });
        y += 5.5;
        text(this.invoiceNumber, pageW - margin, y, { size: 12.5, color: textPrimary, bold: true, align: 'right' });
        y += 6;
        text('ORDER NUMBER', pageW - margin, y, { size: 7.5, color: textMuted, bold: true, align: 'right' });
        y += 5;
        text(`${this.placedOrderNumber || this.placedOrderId}`, pageW - margin, y, { size: 14, color: brandPrimary, bold: true, align: 'right' });

        // =====================
        //  TITLE: INVOICE (Clean sans-serif modern title)
        // =====================
        y = 46;
        pdf.setFontSize(22);
        pdf.setTextColor(...textPrimary);
        pdf.setFont('helvetica', 'bold');
        pdf.text('INVOICE', margin, y);

        y += 4;
        hLine(y, borderColor, 0.5);
        y += 8;

        // =====================
        //  DATE / PAYMENT METADATA
        // =====================
        text('DATE ISSUED:', margin, y, { size: 7.5, color: textMuted, bold: true });
        text(this.formattedDate, margin + 24, y, { size: 9, color: textPrimary, bold: true });

        text('PAYMENT METHOD:', pageW - margin - 65, y, { size: 7.5, color: textMuted, bold: true });
        text(this.paymentMethodDisplay, pageW - margin, y, { size: 9, color: textPrimary, bold: true, align: 'right' });

        y += 5.5;
        text('ORDER TIME:', margin, y, { size: 7.5, color: textMuted, bold: true });
        text(this.formattedTime, margin + 24, y, { size: 9, color: textPrimary, bold: true });

        text('PAYMENT STATUS:', pageW - margin - 65, y, { size: 7.5, color: textMuted, bold: true });
        const rawStatus = this.paymentStatusInfo.rawStatus;
        const statusColor: [number, number, number] = rawStatus === 'paid'
            ? green
            : rawStatus === 'refund_due'
                ? [220, 38, 38]
                : rawStatus === 'awaiting_verification'
                    ? [37, 99, 235]
                    : brandAccent;

        const maxStatusWidthMm = 45;
        const statusText = this.paymentStatusDisplay;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        const statusLines = pdf.splitTextToSize(statusText, maxStatusWidthMm);
        if (statusLines.length > 1) {
            let statusY = y - 1;
            statusLines.forEach((sLine: string, idx: number) => {
                text(sLine, pageW - margin, statusY + (idx * 3.5), { size: 8.5, color: statusColor, bold: true, align: 'right' });
            });
            y += (statusLines.length - 1) * 3.5;
        } else {
            text(statusText, pageW - margin, y, { size: 8.5, color: statusColor, bold: true, align: 'right' });
        }
        y += 9.5;

        // =====================
        //  THREE ADDRESS CARDS
        // =====================
        const cardW = (contentW - 8) / 3; // 3 cards with 4mm gaps
        const cardX = [margin, margin + cardW + 4, margin + (cardW + 4) * 2];
        const headerH = 7;
        const innerPad = 4;
        const maxTextW = cardW - (innerPad * 2);

        // Prepare content structures and measure required heights
        const forceBreak = (textStr: string, maxChars = 22) => {
            if (!textStr) return '';
            return textStr.split(' ').map(word => {
                if (word.length <= maxChars) return word;
                let result = '';
                for (let i = 0; i < word.length; i += maxChars) {
                    result += word.substring(i, i + maxChars) + ' ';
                }
                return result.trim();
            }).join(' ');
        };

        // 1. Seller items
        const sellerLines = [
            { text: 'Karukolpo', size: 9, bold: true, color: textPrimary },
            { text: 'Pathrail, Tangail-1912,', size: 8, bold: false, color: textSecondary },
            { text: 'Bangladesh.', size: 8, bold: false, color: textSecondary },
            { text: 'Phone: 01675-718846', size: 8, bold: false, color: textSecondary },
            { text: 'Email: contact@karukolpocrafts.com', size: 8, bold: false, color: textSecondary }
        ];

        let sellerContentH = 0;
        sellerLines.forEach(line => {
            pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
            pdf.setFontSize(line.size);
            const wrapped = pdf.splitTextToSize(forceBreak(line.text), maxTextW);
            const lineH = (line.size * 0.3527) * 1.35;
            sellerContentH += wrapped.length * lineH + 1.2;
        });

        // 2. Bill To items
        const custName = this.orderFormSnapshot.fullName || '—';
        const custPhone = this.orderFormSnapshot.phoneNumber || '';
        const custEmail = this.orderFormSnapshot.email || '';

        const isCustNameBengali = this.hasBengali(custName);
        let custNameImg: { data: string; wMm: number; hMm: number } | null = null;
        let custNameH = 0;
        let custNameLines: string[] = [];

        if (isCustNameBengali) {
            custNameImg = this.renderTextAsImage(custName, { fontSize: 9, color: '#1E1E24', bold: true, maxWidthMm: maxTextW });
            custNameH = custNameImg.hMm;
        } else {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            custNameLines = pdf.splitTextToSize(forceBreak(custName), maxTextW);
            custNameH = custNameLines.length * (9 * 0.3527 * 1.35);
        }

        let billToContentH = custNameH + 1.5;

        let custPhoneLines: string[] = [];
        if (custPhone) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            custPhoneLines = pdf.splitTextToSize(forceBreak(`Phone: ${custPhone}`), maxTextW);
            billToContentH += (custPhoneLines.length * (8 * 0.3527 * 1.35)) + 1.2;
        }

        let custEmailLines: string[] = [];
        if (custEmail) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            custEmailLines = pdf.splitTextToSize(forceBreak(`Email: ${custEmail}`), maxTextW);
            billToContentH += (custEmailLines.length * (8 * 0.3527 * 1.35)) + 1.2;
        }

        // 3. Shipping Address items
        const addr = this.orderFormSnapshot.fullAddress || '—';
        const subDist = this.orderFormSnapshot.subDistrict || '';
        const dist = this.orderFormSnapshot.district || '';
        const postal = this.orderFormSnapshot.postalCode || '';
        const combinedAddr = [addr, subDist, dist, postal ? `Postal Code: ${postal}` : ''].filter(s => !!s).join(', ');

        const isAddrBengali = this.hasBengali(combinedAddr);
        let addrImg: { data: string; wMm: number; hMm: number } | null = null;
        let addrLines: string[] = [];
        let addrContentH = 0;

        if (isAddrBengali) {
            addrImg = this.renderTextAsImage(combinedAddr, { fontSize: 8, color: '#52525B', maxWidthMm: maxTextW });
            addrContentH = addrImg.hMm;
        } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            addrLines = pdf.splitTextToSize(forceBreak(combinedAddr), maxTextW);
            addrContentH = addrLines.length * (8 * 0.3527 * 1.35);
        }

        // Compute unified dynamic card height
        const maxContentH = Math.max(sellerContentH, billToContentH, addrContentH);
        const cardH = Math.max(42, headerH + maxContentH + 7);

        // Draw clean corporate cards (white fill, light gray header bar, crisp outline)
        for (let i = 0; i < 3; i++) {
            pdf.setFillColor(...surfaceBg);
            pdf.setDrawColor(...borderColor);
            pdf.setLineWidth(0.35);
            pdf.roundedRect(cardX[i], y, cardW, cardH, 1.5, 1.5, 'FD');

            // Header bar in neutral slate-tinted grey
            pdf.setFillColor(...cardHeaderBg);
            pdf.rect(cardX[i], y, cardW, headerH, 'F');

            // Header bottom separator line
            pdf.setDrawColor(...borderColor);
            pdf.setLineWidth(0.35);
            pdf.line(cardX[i], y + headerH, cardX[i] + cardW, y + headerH);

            // Re-stroke outer rounded border
            pdf.roundedRect(cardX[i], y, cardW, cardH, 1.5, 1.5, 'S');
        }

        const headers = ['SELLER', 'BILL TO', 'SHIPPING ADDRESS'];
        for (let i = 0; i < 3; i++) {
            text(headers[i], cardX[i] + innerPad, y + 4.8, { size: 7.2, color: textPrimary, bold: true });
        }

        // Render card content
        const bodyY = y + headerH + 4;

        // Render Seller
        let currentSellerY = bodyY;
        sellerLines.forEach((line, idx) => {
            pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
            pdf.setFontSize(line.size);
            const wrapped = pdf.splitTextToSize(forceBreak(line.text), maxTextW);
            const lineH = (line.size * 0.3527) * 1.35;
            wrapped.forEach((wLine: string) => {
                text(wLine, cardX[0] + innerPad, currentSellerY + (line.size * 0.3527 * 0.8), { size: line.size, color: line.color, bold: line.bold });
                currentSellerY += lineH;
            });
            currentSellerY += (idx === 0 ? 1.5 : (idx === 2 ? 2.5 : 1.0));
        });

        // Render Bill To
        let currentBillToY = bodyY;
        if (isCustNameBengali && custNameImg) {
            pdf.addImage(custNameImg.data, 'PNG', cardX[1] + innerPad, currentBillToY, custNameImg.wMm, custNameImg.hMm, undefined, 'FAST');
            currentBillToY += custNameImg.hMm + 2;
        } else {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            const lineH = 9 * 0.3527 * 1.35;
            custNameLines.forEach((wLine: string) => {
                text(wLine, cardX[1] + innerPad, currentBillToY + (9 * 0.3527 * 0.8), { size: 9, color: textPrimary, bold: true });
                currentBillToY += lineH;
            });
            currentBillToY += 1.8;
        }

        if (custPhoneLines.length > 0) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const lineH = 8 * 0.3527 * 1.35;
            custPhoneLines.forEach((wLine: string) => {
                text(wLine, cardX[1] + innerPad, currentBillToY + (8 * 0.3527 * 0.8), { size: 8, color: textSecondary });
                currentBillToY += lineH;
            });
            currentBillToY += 1.2;
        }

        if (custEmailLines.length > 0) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const lineH = 8 * 0.3527 * 1.35;
            custEmailLines.forEach((wLine: string) => {
                text(wLine, cardX[1] + innerPad, currentBillToY + (8 * 0.3527 * 0.8), { size: 8, color: textSecondary });
                currentBillToY += lineH;
            });
        }

        // Render Shipping Address
        let currentAddrY = bodyY;
        if (isAddrBengali && addrImg) {
            pdf.addImage(addrImg.data, 'PNG', cardX[2] + innerPad, currentAddrY, addrImg.wMm, addrImg.hMm, undefined, 'FAST');
        } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const lineH = 8 * 0.3527 * 1.35;
            addrLines.forEach((wLine: string) => {
                text(wLine, cardX[2] + innerPad, currentAddrY + (8 * 0.3527 * 0.8), { size: 8, color: textSecondary });
                currentAddrY += lineH;
            });
        }

        y += cardH + 7;

        // =====================
        //  PRODUCTS TABLE (AutoTable)
        // =====================
        const tableBody = (this.orderedItems || []).map((item: any) => {
            const name = item.product?.name || item.product?.code || `Product ID: ${item.product?.id || 'Unknown'}`;
            const isBengali = this.hasBengali(name);

            // Available width for product name column is ~66mm
            const nameImageData = isBengali ? this.renderTextAsImage(name, { fontSize: 9.5, color: '#26221F', bold: true, maxWidthMm: 66 }) : null;
            const displayName = isBengali ? '' : name;

            const qty = item.quantity || 0;
            const price = item.price_at_purchase ?? item.price ?? item.product?.effective_price ?? item.product?.price ?? 0;
            const lineTotal = price * qty;

            return [
                { 
                    content: displayName, 
                    nameImage: nameImageData ? nameImageData.data : null,
                    imageW: nameImageData ? nameImageData.wMm : 0,
                    imageH: nameImageData ? nameImageData.hMm : 0
                },
                qty.toString(), 
                `BDT ${price.toLocaleString()}`, 
                `BDT ${lineTotal.toLocaleString()}`
            ];
        });

        autoTable(pdf, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['ITEM & DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT']],
            body: tableBody,
            styles: {
                fontSize: 8.5,
                cellPadding: 4,
                textColor: textPrimary,
                lineColor: borderColor,
                lineWidth: 0.3,
                minCellHeight: 11
            },
            headStyles: {
                fillColor: tableHeadBg,
                textColor: textPrimary,
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 3.5,
                halign: 'left'
            },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { halign: 'center', cellWidth: 22 },
                2: { halign: 'right', cellWidth: 32 },
                3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: tableAltBg },
            theme: 'grid',
            didParseCell: (data: any) => {
                if (data.column.index === 0 && data.cell.raw && data.cell.raw.imageH) {
                    data.cell.styles.minCellHeight = Math.max(11, data.cell.raw.imageH + 6);
                }
            },
            didDrawCell: (data: any) => {
                if (data.column.index === 0 && data.cell.raw && data.cell.raw.nameImage) {
                    const cell = data.cell;
                    const raw = cell.raw;
                    const padding = 4;
                    const yOffset = (cell.height - raw.imageH) / 2;
                    pdf.addImage(raw.nameImage, 'PNG', cell.x + padding, cell.y + Math.max(2, yOffset), raw.imageW, raw.imageH, undefined, 'FAST');
                }
            }
        });

        y = (pdf as any).lastAutoTable.finalY + 9;

        // =====================
        //  FOOTER: Notes + Totals
        // =====================
        const notesX = margin;
        const totalsX = margin + contentW - 74;
        const totalsW = 74;

        // Notes (Professional E-Commerce terms)
        text('TERMS & NOTES', notesX, y, { size: 7.5, color: textMuted, bold: true });
        const notes = [
            '• Computer-generated sales receipt from Karukolpo.',
            '• Handloom authentic craftsmanship with quality warranty.',
            '• For support or inquiries, email contact@karukolpocrafts.com'
        ];
        notes.forEach((note, i) => {
            text(note, notesX, y + 4.5 + (i * 4), { size: 7.8, color: textSecondary });
        });

        // Totals
        const totRow = (label: string, value: string, yPos: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
            text(label, totalsX, yPos, { size: 8.5, color: opts.color || textSecondary });
            text(value, totalsX + totalsW, yPos, { size: 8.5, color: opts.color || textPrimary, align: 'right', bold: opts.bold ?? true });
        };

        let currentY = y;
        totRow('Subtotal:', `BDT ${this.subtotal.toLocaleString()}`, currentY);
        currentY += 5.5;
        totRow('Delivery Fee:', `BDT ${this.orderDeliveryCharge.toLocaleString()}`, currentY);
        if (this.discount > 0) {
            currentY += 5.5;
            totRow('Discount Applied:', `- BDT ${this.discount.toLocaleString()}`, currentY, { color: brandAccent, bold: true });
        }

        // Grand Total
        y = currentY + 9;
        hLine(y, borderColor, 0.5);
        y += 6.5;

        const grandTotalStr = `BDT ${this.grandTotal.toLocaleString()}`;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        const labelW = pdf.getTextWidth('TOTAL AMOUNT');

        let amountFontSize = 14;
        pdf.setFontSize(amountFontSize);
        let amountW = pdf.getTextWidth(grandTotalStr);

        if (labelW + amountW + 5 > totalsW) {
            amountFontSize = 12.5;
            pdf.setFontSize(amountFontSize);
            amountW = pdf.getTextWidth(grandTotalStr);
        }

        if (labelW + amountW + 3 > totalsW) {
            text('TOTAL AMOUNT', totalsX, y, { size: 10, color: textPrimary, bold: true });
            y += 6;
            text(grandTotalStr, totalsX + totalsW, y, { size: 13, color: textPrimary, bold: true, align: 'right' });
        } else {
            text('TOTAL AMOUNT', totalsX, y, { size: 10.5, color: textPrimary, bold: true });
            text(grandTotalStr, totalsX + totalsW, y, { size: amountFontSize, color: textPrimary, bold: true, align: 'right' });
        }

        // Amount Due / Paid Badge (Clean commercial badge)
        y += 10;
        const boxX = totalsX;
        const boxW = totalsW;
        const boxH = 16;
        
        const isPaid = this.paymentStatusDisplay.toLowerCase() === 'paid';
        const badgeBg: [number, number, number] = isPaid ? [240, 253, 244] : [244, 244, 245];
        const badgeBorder: [number, number, number] = isPaid ? [187, 247, 208] : borderColor;
        const badgeTextColor: [number, number, number] = isPaid ? green : textPrimary;
        const due = isPaid ? 0 : (this.amountDue !== undefined ? this.amountDue : this.grandTotal);

        pdf.setFillColor(...badgeBg);
        pdf.setDrawColor(...badgeBorder);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(boxX, y, boxW, boxH, 1.5, 1.5, 'FD');

        const badgeLabel = isPaid ? 'AMOUNT PAID' : (due < 0 ? 'REFUND DUE' : 'AMOUNT DUE');
        const displayAmt = due < 0 ? -due : due;
        text(badgeLabel, boxX + boxW / 2, y + 5, { size: 7, color: textMuted, bold: true, align: 'center' });
        text(`BDT ${displayAmt.toLocaleString()}`, boxX + boxW / 2, y + 11.5, { size: 12.5, color: badgeTextColor, bold: true, align: 'center' });

        // Page Bottom Clean Minimal Footer
        const footerY = pageH - 12;
        hLine(footerY, borderColor, 0.35);
        text(
            'Karukolpo • Tangail, Bangladesh • www.karukolpocrafts.com • support@karukolpocrafts.com',
            pageW / 2,
            footerY + 4.5,
            { size: 7.2, color: textMuted, align: 'center' }
        );

        // =====================
        //  SAVE
        // =====================
        this.savePdf(pdf, `Invoice-${this.invoiceNumber}.pdf`);
    }

    private savePdf(pdf: jsPDF, filename: string): void {
        try {
            const blob = pdf.output('blob');
            if (typeof window !== 'undefined' && window.URL && document) {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    try {
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } catch (e) {}
                }, 1000);
                return;
            }
        } catch (err) {
            console.warn('Direct blob download failed, falling back to pdf.save():', err);
        }
        pdf.save(filename);
    }
}
