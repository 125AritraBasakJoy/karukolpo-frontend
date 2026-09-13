import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { THERMAL_LOGO_BASE64 } from './thermal-logo.constant';

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  regularPrice?: number | null;
  discount?: number | null;
  lineTotal: number;
}

@Component({
  selector: 'app-thermal-invoice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './thermal-invoice.component.html',
  styleUrls: ['./thermal-invoice.component.scss']
})
export class ThermalInvoiceComponent implements AfterViewInit, OnChanges {
  @ViewChild('thermalReceipt', { static: false }) receiptElementRef!: ElementRef<HTMLElement>;
  @ViewChild('barcodeSvg', { static: false }) barcodeSvgRef?: ElementRef<SVGSVGElement>;

  readonly logoSrc = THERMAL_LOGO_BASE64;

  /** Full order/sale object if available */
  @Input() order: any = null;

  /** Or individual properties if passed directly from form */
  @Input() orderedItems: any[] = [];
  @Input() customer: any = {};
  @Input() paymentMethod: string = 'Cash';
  @Input() deliveryCharge: number = 0;
  @Input() discount: number = 0;
  @Input() total: number = 0;
  @Input() orderDate: Date | string = new Date();
  @Input() orderNumber: string = '';
  @Input() orderId: string = '';
  @Input() note: string = '';

  @Output() printCompleted = new EventEmitter<void>();
  @Output() downloadCompleted = new EventEmitter<void>();

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    this.renderBarcode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isBrowser) {
      setTimeout(() => this.renderBarcode(), 50);
    }
  }

  get orderNumberDisplay(): string {
    if (this.order?.orderNumber) return this.order.orderNumber;
    if (this.order?.order_number) return this.order.order_number;
    if (this.orderNumber) return this.orderNumber;
    if (this.order?.id) return `ORD-${this.order.id.slice(-6)}`;
    if (this.orderId) return `ORD-${this.orderId.slice(-6)}`;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `REC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  private get receiptDate(): Date {
    const rawDate = this.order?.orderDate || this.order?.sold_at || this.order?.created_at || this.orderDate;
    return rawDate ? new Date(rawDate) : new Date();
  }

  get formattedDateOnly(): string {
    return this.receiptDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  get formattedTimeOnly(): string {
    return this.receiptDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  get formattedDateTime(): string {
    return `${this.formattedDateOnly}, ${this.formattedTimeOnly}`;
  }

  get paymentMethodDisplay(): string {
    const m = (this.order?.paymentMethod || this.order?.payment_method || this.paymentMethod || 'cash').toLowerCase();
    if (m.includes('bkash')) return 'bKash';
    if (m.includes('nagad')) return 'Nagad';
    if (m.includes('bank')) return 'Bank Transfer';
    if (m.includes('cod')) return 'Cash on Delivery';
    return 'Cash';
  }

  get customerNameDisplay(): string {
    return this.order?.fullName ||
      this.order?.customer?.name ||
      this.order?.address?.full_name ||
      this.customer?.name ||
      this.customer?.fullName ||
      '';
  }

  get customerPhoneDisplay(): string {
    return this.order?.phoneNumber ||
      this.order?.customer?.phone ||
      this.order?.address?.phone ||
      this.customer?.phone ||
      this.customer?.phoneNumber ||
      '';
  }

  get customerAddressDisplay(): string {
    const addr = this.order?.fullAddress ||
      this.order?.customer?.address_line ||
      this.order?.address?.address_line ||
      this.customer?.address_line ||
      this.customer?.fullAddress ||
      '';
    const subdistrict = this.order?.subDistrict ||
      this.order?.customer?.subdistrict ||
      this.order?.address?.subdistrict ||
      this.customer?.subdistrict ||
      '';
    const district = this.order?.district ||
      this.order?.customer?.district ||
      this.order?.address?.district ||
      this.customer?.district ||
      '';

    const parts = [addr, subdistrict, district].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Sanitizes product names so no internal database IDs, PROD-codes, or UUIDs are shown
   */
  private cleanProductName(rawName: string | undefined | null): string {
    if (!rawName) return 'Product';
    let name = rawName.trim();
    // If name is just a UUID or PROD-UUID
    if (/^PROD-[a-f0-9-]+$/i.test(name) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(name)) {
      return 'Product';
    }
    // Remove any embedded "(PROD-...)", "(ID:...)", or raw UUIDs in parentheses
    name = name.replace(/\s*\((PROD-|ID:?|[a-f0-9-]{8,})[^)]*\)/gi, '').trim();
    return name || 'Product';
  }

  get parsedItems(): ThermalReceiptItem[] {
    const rawItems = (this.order?.items && this.order.items.length) ? this.order.items : this.orderedItems;
    if (!rawItems || !rawItems.length) return [];

    return rawItems.map((item: any) => {
      const rawName = item.product?.name || item.name;
      const name = this.cleanProductName(rawName);
      const quantity = Number(item.quantity) || 1;

      // Effective unit price
      const unitPrice = item.unit_price != null ? Number(item.unit_price) :
        (item.price_at_purchase != null ? Number(item.price_at_purchase) :
          (item.price != null ? Number(item.price) :
            (item.product?.effective_price != null ? Number(item.product.effective_price) :
              (item.product?.price != null ? Number(item.product.price) : 0))));

      // Regular catalog price
      let regularPrice: number | null = null;
      if (item.regular_price != null && Number(item.regular_price) > 0) {
        regularPrice = Number(item.regular_price);
      } else if (item.product?.price != null && Number(item.product.price) > 0) {
        regularPrice = Number(item.product.price);
      }

      // Unit discount
      let unitDiscount = 0;
      if (item.discount != null && Number(item.discount) > 0) {
        unitDiscount = Number(item.discount);
      } else if (regularPrice && regularPrice > unitPrice) {
        unitDiscount = regularPrice - unitPrice;
      }

      const lineTotal = unitPrice * quantity;

      return {
        name,
        quantity,
        unitPrice,
        regularPrice: unitDiscount > 0 ? (regularPrice || unitPrice + unitDiscount) : null,
        discount: unitDiscount > 0 ? unitDiscount : null,
        lineTotal
      };
    });
  }

  get subtotalDisplay(): number {
    return this.parsedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }

  get totalDiscountDisplay(): number {
    if (this.order?.discountAmount != null && Number(this.order.discountAmount) > 0) {
      return Number(this.order.discountAmount);
    }
    if (this.discount > 0) {
      return this.discount;
    }
    // Calculate from item discounts
    return this.parsedItems.reduce((sum, item) => sum + ((item.discount || 0) * item.quantity), 0);
  }

  get deliveryChargeDisplay(): number {
    if (this.order?.deliveryCharge != null) return Number(this.order.deliveryCharge);
    if (this.order?.delivery_charge != null) return Number(this.order.delivery_charge);
    return Number(this.deliveryCharge) || 0;
  }

  get grandTotalDisplay(): number {
    if (this.order?.totalAmount != null && Number(this.order.totalAmount) > 0) {
      return Number(this.order.totalAmount);
    }
    if (this.order?.total_amount != null && Number(this.order.total_amount) > 0) {
      return Number(this.order.total_amount);
    }
    if (this.total > 0) {
      return this.total;
    }
    return Math.max(0, this.subtotalDisplay + this.deliveryChargeDisplay);
  }

  private renderBarcode(): void {
    if (!this.isBrowser) return;
    try {
      if (this.barcodeSvgRef?.nativeElement) {
        JsBarcode(this.barcodeSvgRef.nativeElement, this.orderNumberDisplay, {
          format: 'CODE128',
          width: 1.2,
          height: 32,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          margin: 4,
          lineColor: '#000000'
        });
      }
    } catch (err) {
      console.warn('Could not generate barcode for thermal invoice:', err);
    }
  }

  /**
   * Generates a crisp 58mm thermal receipt PDF directly via offscreen Canvas 2D
   * Runs in ~10ms without freezing the browser or locking the event loop.
   */
  async downloadReceipt(): Promise<void> {
    if (!this.isBrowser) return;

    try {
      const canvas = await this.generateThermalCanvas();
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 58; // 58mm roll width
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      this.savePdf(pdf, `Thermal-Receipt-${this.orderNumberDisplay}.pdf`);
      this.downloadCompleted.emit();
    } catch (e) {
      console.error('Failed to download thermal receipt PDF:', e);
    }
  }

  private async generateThermalCanvas(): Promise<HTMLCanvasElement> {
    const width = 576; // 58mm roll at standard thermal resolution
    const margin = 24;
    const printableWidth = width - margin * 2; // 528px

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = 3500;
    const ctx = tempCanvas.getContext('2d')!;

    // Pure white background for thermal printer contrast
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, tempCanvas.height);
    ctx.fillStyle = '#000000';

    const fontMono = "'Courier New', Courier, monospace, 'Segoe UI', 'Noto Sans Bengali', sans-serif";
    const fontSans = "'Segoe UI', 'Noto Sans Bengali', 'Inter', -apple-system, sans-serif";

    let y = 20;

    // 1. Logo
    try {
      const logoImg = await this.loadImageElement(this.logoSrc);
      const logoW = 240;
      const logoH = logoImg.naturalHeight && logoImg.naturalWidth
        ? (logoImg.naturalHeight / logoImg.naturalWidth) * logoW
        : 162;
      const logoX = (width - logoW) / 2;
      ctx.drawImage(logoImg, logoX, y, logoW, logoH);
      y += logoH + 10;
    } catch (e) {
      console.warn('Could not load logo for canvas:', e);
    }

    // 2. Store Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.font = `bold 22px ${fontMono}`;
    ctx.fillText('KARUKOLPO', width / 2, y);
    y += 28;

    ctx.font = `14px ${fontMono}`;
    ctx.fillText('Pathrail, Delduar, Tangail-1912', width / 2, y);
    y += 20;

    ctx.fillText('www.karukolpocrafts.com', width / 2, y);
    y += 24;

    // Double Line
    y = this.drawCanvasDoubleLine(ctx, margin, width - margin, y);
    y += 6;

    // Receipt Type
    ctx.font = `bold 16px ${fontMono}`;
    ctx.fillText('*** POS SALES RECEIPT ***', width / 2, y);
    y += 24;

    // Dashed Line
    y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
    y += 8;

    // 3. Metadata Section
    ctx.font = `14.5px ${fontMono}`;
    y = this.drawCanvasRow(ctx, margin, width - margin, 'RECEIPT #:', this.orderNumberDisplay, y, true);
    y = this.drawCanvasRow(ctx, margin, width - margin, 'DATE:', this.formattedDateOnly, y, false);
    y = this.drawCanvasRow(ctx, margin, width - margin, 'TIME:', this.formattedTimeOnly, y, false);
    y = this.drawCanvasRow(ctx, margin, width - margin, 'PAYMENT:', this.paymentMethodDisplay.toUpperCase(), y, true);
    y += 4;

    // 4. Customer Section (if present)
    if (this.customerNameDisplay || this.customerPhoneDisplay || this.customerAddressDisplay) {
      y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
      y += 6;

      ctx.textAlign = 'left';
      ctx.font = `bold 14.5px ${fontMono}`;
      ctx.fillText('CUSTOMER INFO:', margin, y);
      y += 22;

      if (this.customerNameDisplay) {
        y = this.drawCanvasRow(ctx, margin, width - margin, 'Name:', this.customerNameDisplay, y, true);
      }
      if (this.customerPhoneDisplay) {
        y = this.drawCanvasRow(ctx, margin, width - margin, 'Phone:', this.customerPhoneDisplay, y, true);
      }
      if (this.customerAddressDisplay) {
        y = this.drawCanvasRow(ctx, margin, width - margin, 'Address:', this.customerAddressDisplay, y, false);
      }
      y += 4;
    }

    // Double Line
    y = this.drawCanvasDoubleLine(ctx, margin, width - margin, y);
    y += 6;

    // 5. Items Header
    ctx.font = `bold 15px ${fontMono}`;
    ctx.textAlign = 'left';
    ctx.fillText('ITEM / DETAILS', margin, y);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL', width - margin, y);
    y += 22;

    y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
    y += 8;

    // 6. Line Items List
    for (const item of this.parsedItems) {
      // Product Name (wrapped)
      ctx.textAlign = 'left';
      ctx.font = `bold 15px ${fontSans}`;
      y = this.drawCanvasWrappedText(ctx, item.name, margin, y, printableWidth, 21);

      // Qty x Price (left) and Line Total (right)
      ctx.font = `14.5px ${fontSans}`;
      ctx.textAlign = 'left';
      const qtyText = `${item.quantity} x ৳${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      ctx.fillText(qtyText, margin, y);

      ctx.textAlign = 'right';
      ctx.font = `bold 15.5px ${fontSans}`;
      const totalText = `৳${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      ctx.fillText(totalText, width - margin, y);
      y += 20;

      // Discount pill if item has discount
      if (item.discount && item.discount > 0) {
        ctx.textAlign = 'left';
        ctx.font = `italic 12.5px ${fontSans}`;
        const regFormatted = item.regularPrice ? item.regularPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '';
        const discFormatted = item.discount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        ctx.fillText(`Reg: ৳${regFormatted} (Save: -৳${discFormatted})`, margin, y);
        y += 18;
      }

      y += 6;
    }

    // Dashed Line
    y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
    y += 8;

    // 7. Totals Section
    ctx.font = `14.5px ${fontSans}`;
    const subtotalFormatted = `৳${this.subtotalDisplay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    y = this.drawCanvasRow(ctx, margin, width - margin, 'Subtotal:', subtotalFormatted, y, true);

    if (this.totalDiscountDisplay > 0) {
      const discountFormatted = `-৳${this.totalDiscountDisplay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      y = this.drawCanvasRow(ctx, margin, width - margin, 'Discount:', discountFormatted, y, true);
    }

    const deliveryFormatted = `৳${this.deliveryChargeDisplay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    y = this.drawCanvasRow(ctx, margin, width - margin, 'Delivery Charge:', deliveryFormatted, y, false);
    y += 4;

    // Double Line
    y = this.drawCanvasDoubleLine(ctx, margin, width - margin, y);
    y += 8;

    // Grand Total
    ctx.font = `bold 20px ${fontSans}`;
    const grandFormatted = `৳${this.grandTotalDisplay.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL:', margin, y);
    ctx.textAlign = 'right';
    ctx.fillText(grandFormatted, width - margin, y);
    y += 28;

    // Dashed Line
    y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
    y += 8;

    // 8. Note (if any)
    const noteText = this.order?.note || this.note;
    if (noteText) {
      ctx.textAlign = 'left';
      ctx.font = `bold 14px ${fontMono}`;
      ctx.fillText('Note:', margin, y);
      y += 18;
      ctx.font = `13px ${fontMono}`;
      y = this.drawCanvasWrappedText(ctx, noteText, margin, y, printableWidth, 18);
      y = this.drawCanvasDashedLine(ctx, margin, width - margin, y);
      y += 8;
    }

    // 9. Barcode
    try {
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, this.orderNumberDisplay, {
        format: 'CODE128',
        width: 2,
        height: 52,
        displayValue: true,
        font: 'monospace',
        fontSize: 13,
        margin: 4,
        lineColor: '#000000'
      });
      const bx = (width - barcodeCanvas.width) / 2;
      ctx.drawImage(barcodeCanvas, bx, y);
      y += barcodeCanvas.height + 12;
    } catch (e) {
      console.warn('Could not generate barcode for canvas:', e);
    }

    // 10. Footer Text
    ctx.textAlign = 'center';
    ctx.font = `bold 15px ${fontMono}`;
    ctx.fillText('THANK YOU FOR YOUR PURCHASE!', width / 2, y);
    y += 22;

    ctx.font = `13px ${fontMono}`;
    ctx.fillText('Crafted with tradition & passion.', width / 2, y);
    y += 20;

    ctx.font = `bold 14px ${fontMono}`;
    ctx.fillText('Hotline: 01675-718846', width / 2, y);
    y += 28;

    // Final crop to exact content height
    const finalHeight = Math.max(y, 350);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = finalHeight;
    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.drawImage(tempCanvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);

    return finalCanvas;
  }

  private loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      if (img.complete && img.naturalWidth > 0) {
        resolve(img);
        return;
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for canvas'));
      img.src = src;
    });
  }

  private drawCanvasRow(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    rightX: number,
    leftText: string,
    rightText: string,
    y: number,
    rightBold: boolean = false
  ): number {
    ctx.textAlign = 'left';
    ctx.fillText(leftText, leftX, y);

    ctx.textAlign = 'right';
    if (rightBold) {
      const prevFont = ctx.font;
      ctx.font = prevFont.includes('bold') ? prevFont : `bold ${prevFont}`;
      ctx.fillText(rightText, rightX, y);
      ctx.font = prevFont;
    } else {
      ctx.fillText(rightText, rightX, y);
    }
    return y + 21;
  }

  private drawCanvasDashedLine(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): number {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
    return y + 4;
  }

  private drawCanvasDoubleLine(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): number {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y + 4);
    ctx.lineTo(x2, y + 4);
    ctx.stroke();
    ctx.restore();
    return y + 6;
  }

  private drawCanvasWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    const words = text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n];
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, curY);
      curY += lineHeight;
    }
    return curY;
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

  /**
   * Executes printing directly to the machine printer (Laptop & Mobile, Cable & Bluetooth)
   */
  async printReceipt(): Promise<void> {
    if (!this.isBrowser || !this.receiptElementRef?.nativeElement) return;

    // Machine print via isolated document stream formatted specifically for 58mm rolls
    try {
      let printContent = this.receiptElementRef.nativeElement.innerHTML;
      if (this.logoSrc && !printContent.includes('data:image')) {
        printContent = printContent.replace(/src="[^"]*assets\/invoice-logo-mandala\.jpg[^"]*"/g, `src="${this.logoSrc}"`);
      }
      const baseOrigin = window.location.origin;
      const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <base href="${baseOrigin}/">
          <title>Receipt-${this.orderNumberDisplay}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: 58mm auto;
              margin: 0mm 1mm 2mm 1mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 54mm;
              font-family: 'Courier New', Courier, monospace, sans-serif;
              color: #000000;
              background: #ffffff;
              font-size: 11px;
              line-height: 1.25;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            
            .receipt-logo {
              display: block;
              max-width: 36mm;
              height: auto;
              margin: 0 auto 4px auto;
              filter: grayscale(100%) contrast(160%);
            }
            .store-name {
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 1px;
              margin: 2px 0;
            }
            .store-info {
              font-size: 9px;
              line-height: 1.2;
            }
            .thermal-divider {
              border: 0;
              border-top: 1px dashed #000000;
              margin: 4px 0;
            }
            .thermal-divider-double {
              border: 0;
              border-top: 2px solid #000000;
              margin: 5px 0;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin-bottom: 2px;
            }
            .customer-section {
              margin: 2px 0;
            }
            .item-row {
              margin-bottom: 4px;
            }
            .item-title {
              font-weight: bold;
              font-size: 10.5px;
              word-break: break-word;
            }
            .item-calc-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
            }
            .item-discount-pill {
              font-size: 8.5px;
              font-style: italic;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              font-size: 10.5px;
              margin-bottom: 2px;
            }
            .grand-total-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 900;
              margin: 4px 0;
            }
            .receipt-footer {
              font-size: 9.5px;
              margin-top: 6px;
              text-align: center;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              margin: 3px 0;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            function triggerPrintWhenReady() {
              var images = Array.from(document.images);
              var pending = images.filter(function(img) { return !img.complete; });
              if (pending.length === 0) {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 100);
              } else {
                Promise.all(pending.map(function(img) {
                  return new Promise(function(resolve) {
                    img.onload = img.onerror = resolve;
                  });
                })).then(function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 150);
                });
              }
            }
            if (document.readyState === 'complete') {
              triggerPrintWhenReady();
            } else {
              window.addEventListener('load', triggerPrintWhenReady);
            }
          </script>
        </body>
        </html>
      `;

      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

      if (isMobile) {
        // Mobile browsers handle popup print windows much better than hidden iframes
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(receiptHtml);
          printWindow.document.close();
        } else {
          // Fallback if popup blocked
          this.triggerIframePrint(receiptHtml);
        }
      } else {
        // Desktop / Laptop (USB Cable / Bluetooth) - print cleanly through isolated iframe
        this.triggerIframePrint(receiptHtml);
      }

      this.printCompleted.emit();
    } catch (e) {
      console.error('Failed to trigger machine print:', e);
    }
  }

  private triggerIframePrint(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
    }, 60000);
  }
}
