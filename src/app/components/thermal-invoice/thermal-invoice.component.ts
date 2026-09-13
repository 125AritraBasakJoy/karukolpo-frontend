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
import html2canvas from 'html2canvas';
import JsBarcode from 'jsbarcode';

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
   * Generates a 58mm PDF and triggers download
   */
  async downloadReceipt(): Promise<void> {
    if (!this.isBrowser || !this.receiptElementRef?.nativeElement) return;

    try {
      const element = this.receiptElementRef.nativeElement;
      const canvas = await html2canvas(element, {
        scale: 3, // High DPI for crisp thermal printing
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 58; // 58mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(pdfHeight + 4, 60)]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Thermal-Receipt-${this.orderNumberDisplay}.pdf`);
      this.downloadCompleted.emit();
    } catch (e) {
      console.error('Failed to download thermal receipt PDF:', e);
    }
  }

  /**
   * Executes both PDF download and sends to machine printer via isolated iframe
   */
  async printReceipt(): Promise<void> {
    if (!this.isBrowser || !this.receiptElementRef?.nativeElement) return;

    // 1. Download PDF as requested
    await this.downloadReceipt();

    // 2. Machine print via isolated iframe formatted specifically for 58mm roll
    try {
      const printContent = this.receiptElementRef.nativeElement.innerHTML;
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
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt-${this.orderNumberDisplay}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 1mm 1.5mm 3mm 1.5mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              margin: 0;
              padding: 0;
              width: 55mm;
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
            .store-title {
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 1px;
              margin: 2px 0;
            }
            .store-sub {
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
            .customer-box {
              font-size: 10px;
              margin: 3px 0;
            }
            .item-row {
              margin-bottom: 4px;
            }
            .item-name {
              font-weight: bold;
              font-size: 10.5px;
              word-break: break-word;
            }
            .item-calc {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
            }
            .item-discount-note {
              font-size: 9px;
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
            .footer-msg {
              font-size: 9.5px;
              margin-top: 6px;
              text-align: center;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              margin: 4px 0;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body onload="setTimeout(function(){ window.focus(); window.print(); }, 250);">
          ${printContent}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
      }, 60000);

      this.printCompleted.emit();
    } catch (e) {
      console.error('Failed to trigger machine print:', e);
    }
  }
}
