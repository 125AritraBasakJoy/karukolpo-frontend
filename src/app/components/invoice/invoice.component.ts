import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { THERMAL_LOGO_BASE64 } from '../thermal-invoice/thermal-logo.constant';

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

    @Output() continueShoppingClick = new EventEmitter<void>();

    today = new Date();

    get invoiceNumber(): string {
        const year = this.today.getFullYear();
        // Use orderNumber if available, otherwise fallback to id
        const idPart = (this.placedOrderNumber || this.placedOrderId || '0').slice(-5);
        return `INV-${year}-${idPart}`;
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
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();    // 210
        const pageH = pdf.internal.pageSize.getHeight();   // 297
        const margin = 20;
        const contentW = pageW - margin * 2;               // 170
        let y = 14; // current Y cursor

        // ---- Artisanal Warm Theme Palette ----
        const terracotta: [number, number, number] = [184, 78, 41];       // #B84E29 (Primary Brand Accent)
        const darkTerracotta: [number, number, number] = [158, 62, 28];   // #9E3E1C (Deep Terracotta)
        const warmCharcoal: [number, number, number] = [38, 34, 31];      // #26221F (Primary Text)
        const warmDark: [number, number, number] = [56, 49, 43];          // #38312B (Headings)
        const warmMuted: [number, number, number] = [112, 104, 97];       // #706861 (Secondary Text)
        const lightMuted: [number, number, number] = [140, 131, 123];     // #8C837B (Subdued Labels)
        const warmCream: [number, number, number] = [250, 247, 242];      // #FAF7F2 (Card & Box Fill)
        const tableHeadBg: [number, number, number] = [245, 240, 233];    // #F5F0E9 (Table Header Fill)
        const tableAltBg: [number, number, number] = [253, 251, 249];     // #FDFBF9 (Alternate Row Fill)
        const borderColor: [number, number, number] = [232, 223, 213];    // #E8DFD5 (Warm Line & Border)
        const green: [number, number, number] = [46, 125, 50];            // #2E7D32 (Paid Status)

        // ---- Helper: draw text ----
        const text = (
            str: string, x: number, yPos: number,
            opts: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right'; maxW?: number; font?: 'helvetica' | 'times' } = {}
        ) => {
            pdf.setFontSize(opts.size || 10);
            pdf.setTextColor(...(opts.color || warmCharcoal));
            pdf.setFont(opts.font || 'helvetica', opts.bold ? 'bold' : 'normal');
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
            const logoH = 22; // desired height in mm
            const logoW = (829 / 560) * logoH; // maintain aspect ratio (~32.57mm)
            pdf.addImage(THERMAL_LOGO_BASE64, 'JPEG', margin, y, logoW, logoH);
        } catch (e) {
            console.warn('Could not load logo for PDF:', e);
        }

        // =====================
        //  HEADER: Invoice No + Order ID (right side)
        // =====================
        text('INVOICE NO', pageW - margin, y, { size: 7.5, color: lightMuted, bold: true, align: 'right' });
        y += 5;
        text(this.invoiceNumber, pageW - margin, y, { size: 13, color: warmCharcoal, bold: true, align: 'right' });
        y += 6;
        text('ORDER NUMBER', pageW - margin, y, { size: 7.5, color: lightMuted, bold: true, align: 'right' });
        y += 5;
        text(`${this.placedOrderNumber || this.placedOrderId}`, pageW - margin, y, { size: 15, color: terracotta, bold: true, align: 'right' });

        // =====================
        //  TITLE: INVOICE (positioned below the logo)
        // =====================
        y = 48;
        pdf.setFontSize(26);
        pdf.setTextColor(...warmCharcoal);
        pdf.setFont('times', 'bold');
        pdf.text('INVOICE', margin, y);

        y += 5;
        hLine(y, borderColor, 0.6);
        // Terracotta accent bar
        pdf.setFillColor(...terracotta);
        pdf.rect(margin, y - 0.5, 30, 1.2, 'F');
        y += 8;

        // =====================
        //  DATE / PAYMENT ROW
        // =====================
        text('DATE ISSUED:', margin, y, { size: 7.5, color: lightMuted, bold: true });
        text(this.formattedDate, margin + 24, y, { size: 9.5, color: warmCharcoal, bold: true });

        text('PAYMENT METHOD:', pageW - margin - 65, y, { size: 7.5, color: lightMuted, bold: true });
        text(this.paymentMethodDisplay, pageW - margin, y, { size: 9.5, color: terracotta, bold: true, align: 'right' });

        y += 6;
        text('ORDER TIME:', margin, y, { size: 7.5, color: lightMuted, bold: true });
        text(this.formattedTime, margin + 24, y, { size: 9.5, color: warmCharcoal, bold: true });

        text('PAYMENT STATUS:', pageW - margin - 65, y, { size: 7.5, color: lightMuted, bold: true });
        const statusColor = this.paymentStatus === 'Paid' ? green : warmCharcoal;
        text(this.paymentStatus, pageW - margin, y, { size: 9.5, color: statusColor, bold: true, align: 'right' });
        y += 10;

        // =====================
        //  THREE ADDRESS CARDS
        // =====================
        const cardW = (contentW - 8) / 3; // 3 cards with 4mm gaps
        const cardX = [margin, margin + cardW + 4, margin + (cardW + 4) * 2];
        const cardH = 46;
        const headerH = 7.5;

        // Draw card backgrounds and headers
        for (let i = 0; i < 3; i++) {
            // Fill card background with warm cream and stroke border
            pdf.setFillColor(...warmCream);
            pdf.setDrawColor(...borderColor);
            pdf.setLineWidth(0.4);
            pdf.roundedRect(cardX[i], y, cardW, cardH, 2, 2, 'FD');

            // Draw terracotta header bar
            pdf.setFillColor(...terracotta);
            pdf.rect(cardX[i], y, cardW, headerH, 'F');

            // Re-stroke outer rounded border
            pdf.setDrawColor(...borderColor);
            pdf.setLineWidth(0.4);
            pdf.roundedRect(cardX[i], y, cardW, cardH, 2, 2, 'S');
        }

        const headers = ['SELLER', 'BILL TO', 'SHIPPING ADDRESS'];
        for (let i = 0; i < 3; i++) {
            text(headers[i], cardX[i] + 4, y + 5.2, { size: 7.5, color: [255, 255, 255], bold: true });
        }

        // Helper to force-break extremely long words for PDF
        const forceBreak = (textStr: string, maxChars = 25) => {
            if (!textStr) return '';
            return textStr.split(' ').map(word => {
                if (word.length <= maxChars) return word;
                // Force a break every maxChars
                let result = '';
                for (let i = 0; i < word.length; i += maxChars) {
                    result += word.substring(i, i + maxChars) + ' ';
                }
                return result.trim();
            }).join(' ');
        };

        // Card body content
        const bodyY = y + headerH + 5;

        // Seller
        text('Karukolpo', cardX[0] + 4, bodyY, { size: 9.5, color: warmCharcoal, bold: true });
        text('Pathrail, Tangail-1912,', cardX[0] + 4, bodyY + 5, { size: 8, color: warmMuted });
        text('Bangladesh.', cardX[0] + 4, bodyY + 9, { size: 8, color: warmMuted });
        text('Phone: 01675-718846', cardX[0] + 4, bodyY + 20, { size: 8, color: warmMuted });
        text('Email: contact@karukolpocrafts.com', cardX[0] + 4, bodyY + 24, { size: 8, color: warmMuted });

        // Bill To
        const custName = this.orderFormSnapshot.fullName || '—';
        const custPhone = this.orderFormSnapshot.phoneNumber || '';
        const custEmail = this.orderFormSnapshot.email || '';

        let billToY = bodyY;
        if (this.hasBengali(custName)) {
            const nameImg = this.renderTextAsImage(custName, { fontSize: 9.5, color: '#26221F', bold: true, maxWidthMm: cardW - 8 });
            pdf.addImage(nameImg.data, 'PNG', cardX[1] + 4, billToY - 1, nameImg.wMm, nameImg.hMm, undefined, 'FAST');
            billToY += nameImg.hMm + 1.5;
        } else {
            text(forceBreak(custName), cardX[1] + 4, billToY, { size: 9.5, color: warmCharcoal, bold: true, maxW: cardW - 8 });
            billToY += 5;
        }

        if (custPhone) {
            text(`Phone: ${custPhone}`, cardX[1] + 4, billToY, { size: 8, color: warmMuted });
            billToY += 4.5;
        }
        if (custEmail) {
            text(`Email: ${custEmail}`, cardX[1] + 4, billToY, { size: 8, color: warmMuted, maxW: cardW - 8 });
        }

        // Shipping Address
        const addr = this.orderFormSnapshot.fullAddress || '—';
        const subDist = this.orderFormSnapshot.subDistrict || '';
        const dist = this.orderFormSnapshot.district || '';
        const postal = this.orderFormSnapshot.postalCode || '';

        // Combine into one flow for better wrapping
        const combinedAddr = [addr, subDist, dist, postal ? `Postal Code: ${postal}` : ''].filter(s => !!s).join(', ');

        if (this.hasBengali(combinedAddr)) {
            const addrImg = this.renderTextAsImage(combinedAddr, { fontSize: 8, color: '#706861', maxWidthMm: cardW - 8 });
            pdf.addImage(addrImg.data, 'PNG', cardX[2] + 4, bodyY - 1, addrImg.wMm, addrImg.hMm, undefined, 'FAST');
        } else {
            text(forceBreak(combinedAddr), cardX[2] + 4, bodyY, { size: 8, color: warmMuted, maxW: cardW - 8 });
        }

        y += cardH + 8;

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
            head: [['PRODUCT', 'QTY', 'PRICE', 'LINE TOTAL']],
            body: tableBody,
            styles: {
                fontSize: 9,
                cellPadding: 4.5,
                textColor: warmCharcoal,
                lineColor: borderColor,
                lineWidth: 0.3,
                minCellHeight: 12
            },
            headStyles: {
                fillColor: tableHeadBg,
                textColor: warmDark,
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 3.5,
                halign: 'left'
            },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { halign: 'center', cellWidth: 25 },
                2: { halign: 'center', cellWidth: 35 },
                3: { halign: 'center', cellWidth: 35, fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: tableAltBg },
            theme: 'grid',
            didParseCell: (data: any) => {
                if (data.column.index === 0 && data.cell.raw && data.cell.raw.imageH) {
                    data.cell.styles.minCellHeight = Math.max(12, data.cell.raw.imageH + 6);
                }
            },
            didDrawCell: (data: any) => {
                // If it's the product column and we have a generated image
                if (data.column.index === 0 && data.cell.raw && data.cell.raw.nameImage) {
                    const cell = data.cell;
                    const raw = cell.raw;
                    const padding = 4;
                    const yOffset = (cell.height - raw.imageH) / 2;
                    pdf.addImage(raw.nameImage, 'PNG', cell.x + padding, cell.y + Math.max(2, yOffset), raw.imageW, raw.imageH, undefined, 'FAST');
                }
            }
        });

        y = (pdf as any).lastAutoTable.finalY + 10;

        // =====================
        //  FOOTER: Notes + Totals
        // =====================
        const notesX = margin;
        const totalsX = margin + contentW - 72;
        const totalsW = 72;

        // Notes
        text('NOTES & POLICIES:', notesX, y, { size: 7.5, color: lightMuted, bold: true });
        const notes = [
            '• Official system-generated invoice from Karukolpo.',
            '• 100% authentic handcrafted & handloom guarantee.',
            '• For queries or assistance, contact support@karukolpocrafts.com'
        ];
        notes.forEach((note, i) => {
            text(note, notesX, y + 5 + (i * 4.5), { size: 8, color: warmMuted });
        });

        // Totals
        const totRow = (label: string, value: string, yPos: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
            text(label, totalsX, yPos, { size: 9, color: opts.color || warmMuted });
            text(value, totalsX + totalsW, yPos, { size: 9, color: opts.color || warmCharcoal, align: 'right', bold: opts.bold ?? true });
        };

        let currentY = y;
        totRow('Subtotal:', `BDT ${this.subtotal.toLocaleString()}`, currentY);
        currentY += 6;
        totRow('Delivery Fee:', `BDT ${this.orderDeliveryCharge.toLocaleString()}`, currentY);
        if (this.discount > 0) {
            currentY += 6;
            totRow('Discount:', `- BDT ${this.discount.toLocaleString()}`, currentY, { color: terracotta, bold: true });
        }

        // Grand Total
        y = currentY + 10;
        hLine(y, borderColor, 0.6);
        y += 7;

        text('GRAND TOTAL', totalsX, y, { size: 12, color: warmCharcoal, bold: true });
        text(`BDT ${this.grandTotal.toLocaleString()}`, totalsX + totalsW, y, { size: 18, color: terracotta, bold: true, align: 'right' });

        // Amount Due Box (Artisanal redesign)
        y += 12;
        const boxX = totalsX - 4;
        const boxW = totalsW + 8;
        const boxH = 19;
        
        pdf.setFillColor(...warmCream);
        pdf.setDrawColor(...terracotta);
        pdf.setLineWidth(0.8);
        pdf.roundedRect(boxX, y, boxW, boxH, 2.5, 2.5, 'FD');

        text('AMOUNT DUE', boxX + boxW / 2, y + 6, { size: 7.5, color: warmMuted, bold: true, align: 'center' });
        const amountDue = this.paymentStatus === 'Paid' ? 0 : this.grandTotal;
        const amountColor = amountDue === 0 ? green : terracotta;
        text(`BDT ${amountDue.toLocaleString()}`, boxX + boxW / 2, y + 13.5, { size: 15, color: amountColor, bold: true, align: 'center' });

        // Page Bottom Brand Footer
        const footerY = pageH - 12;
        hLine(footerY, borderColor, 0.4);
        text(
            'Thank you for celebrating Bengal’s traditional craftsmanship • www.karukolpocrafts.com',
            pageW / 2,
            footerY + 4.5,
            { size: 7.5, color: lightMuted, align: 'center' }
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
