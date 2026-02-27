import { Component, signal, ViewChildren, QueryList, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { lastValueFrom } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { CartItem } from '../../models/cart.model';
import { districts, District } from '../../data/bangladesh-data';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-cart',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        DropdownModule,
        ToastModule,
        TagModule,
    ],
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.scss'],

})
export class CartComponent implements OnInit {
    loading = signal<boolean>(false);
    today = new Date();

    @ViewChildren(NgModel) formControls!: QueryList<NgModel>;

    checkoutForm = {
        fullName: '',
        email: '',
        phoneNumber: '',
        district: '',
        subDistrict: '',
        postalCode: '',
        fullAddress: '',
        additionalInfo: ''
    };

    districts: District[] = districts;
    subDistricts: string[] = [];
    deliveryLocation: 'Inside Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
    currentDeliveryCharge = 0;

    // Payment flow — inline on the page, no modals
    showPaymentSection = false;
    selectedPaymentMethod: 'COD' | 'bKash' | null = null;
    bkashTrxId = '';
    bkashPhone = '';
    placedOrderId = '';
    orderConfirmed = false;

    // Cash memo data — saved before cart is cleared
    orderedItems: CartItem[] = [];
    orderFormSnapshot: any = {};
    orderPaymentMethod = '';
    orderDeliveryCharge = 0;
    orderTotal = 0;

    // Validation patterns
    emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    postalCodeRegex = /^\d{4}$/;

    constructor(
        public cartService: CartService,
        private orderService: OrderService,
        private productService: ProductService,
        private messageService: MessageService,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo(0, 0);
        }
    }

    updateQuantity(item: CartItem, change: number) {
        this.cartService.updateQuantity(item, change);
    }

    removeItem(item: CartItem) {
        this.cartService.updateQuantity(item, -item.quantity);
    }

    getSubTotal(): number {
        return this.cartService.subTotal();
    }

    getTotalPrice(): number {
        return this.getSubTotal() + this.currentDeliveryCharge;
    }

    onDistrictChange(event: any) {
        const districtName = event.value;
        const selectedDistrict = this.districts.find(d => d.name === districtName);
        this.subDistricts = selectedDistrict ? selectedDistrict.subDistricts : [];
        this.checkoutForm.subDistrict = '';

        if (districtName === 'Tangail') {
            this.currentDeliveryCharge = 70;
            this.deliveryLocation = 'Inside Dhaka';
        } else {
            this.currentDeliveryCharge = 130;
            this.deliveryLocation = 'Outside Dhaka';
        }
    }

    get isCheckoutFormValid(): boolean {
        const { fullName, email, phoneNumber, district, postalCode, fullAddress, subDistrict } = this.checkoutForm;
        const basicValidation = fullName && phoneNumber && district && fullAddress;
        const subDistrictValidation = this.subDistricts.length > 0 ? !!subDistrict : true;
        const isEmailValid = !email || this.emailRegex.test(email); // optional
        const isPhoneValid = this.phoneRegex.test(phoneNumber);
        const isPostalCodeValid = !postalCode || this.postalCodeRegex.test(postalCode);
        return !!(basicValidation && subDistrictValidation && isEmailValid && isPhoneValid && isPostalCodeValid);
    }

    proceedToPayment() {
        if (this.cartService.cart().length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Cart Empty', detail: 'Add items to cart first' });
            return;
        }

        if (!this.isCheckoutFormValid) {
            this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill all required fields correctly.' });
            if (this.formControls) {
                this.formControls.forEach(control => control.control.markAsTouched());
            }
            return;
        }

        this.showPaymentSection = true;
        this.selectedPaymentMethod = null;
        this.bkashPhone = this.checkoutForm.phoneNumber;
        this.placedOrderId = '';

        // Scroll to payment section
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }

    private prepareOrderData(paymentMethod: 'COD' | 'bKash'): any {
        return {
            ...this.checkoutForm,
            items: this.cartService.cart(),
            totalAmount: this.getTotalPrice(),
            status: 'Pending' as 'Pending',
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Confirmed' : 'Pending',
            deliveryLocation: this.deliveryLocation,
            deliveryCharge: this.currentDeliveryCharge,
            orderDate: new Date()
        };
    }

    private saveCashMemoData(paymentMethod: string) {
        this.orderedItems = [...this.cartService.cart()];
        this.orderFormSnapshot = { ...this.checkoutForm };
        this.orderPaymentMethod = paymentMethod;
        this.orderDeliveryCharge = this.currentDeliveryCharge;
        this.orderTotal = this.getTotalPrice();
    }

    getOrderSubTotal(): number {
        return this.orderedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    }

    getInvoiceNo(): string {
        if (!this.placedOrderId) return '';
        const year = new Date().getFullYear();
        const paddedId = this.placedOrderId.toString().padStart(5, '0');
        return `INV-${year}-${paddedId}`;
    }

    async confirmCOD() {
        this.loading.set(true);
        const orderData = this.prepareOrderData('COD');

        try {
            const orderId = await lastValueFrom(this.orderService.createOrder(orderData));
            this.placedOrderId = orderId;
            this.messageService.add({ severity: 'success', summary: 'Order Confirmed', detail: 'Your COD order has been placed successfully.' });

            this.saveCashMemoData('Cash on Delivery');
            this.orderConfirmed = true;
            if (isPlatformBrowser(this.platformId)) {
                window.scrollTo(0, 0);
            }

            const cartItemsToReduce = [...this.orderedItems];
            this.cartService.clearCart();
            this.productService.reduceStock(cartItemsToReduce);
        } catch (err) {
            console.error('COD Order creation failed', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to place order. Please try again.' });
        } finally {
            this.loading.set(false);
        }
    }

    async submitBkashPayment() {
        if (!this.bkashTrxId || !this.bkashPhone) {
            this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Transaction ID and Phone Number are required' });
            return;
        }

        this.loading.set(true);

        if (!this.placedOrderId) {
            const orderData = this.prepareOrderData('bKash');
            try {
                const orderId = await lastValueFrom(this.orderService.createOrder(orderData));
                this.placedOrderId = orderId;
            } catch (err) {
                console.error('bKash Order creation failed', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create order. Please try again.' });
                this.loading.set(false);
                return;
            }
        }

        const oid = parseInt(this.placedOrderId, 10);
        let cleanPhone = this.bkashPhone.replace(/\D/g, '');
        if (cleanPhone.length > 11) {
            cleanPhone = cleanPhone.slice(-11);
        }

        const payload = {
            transaction_id: this.bkashTrxId.trim(),
            sender_phone: cleanPhone
        };

        try {
            await lastValueFrom(this.orderService.submitTrx(oid, payload));
            this.messageService.add({ severity: 'success', summary: 'Payment Submitted', detail: 'Your payment has been submitted for verification.' });

            this.saveCashMemoData('bKash');
            this.orderConfirmed = true;
            if (isPlatformBrowser(this.platformId)) {
                window.scrollTo(0, 0);
            }

            const cartItemsToReduce = [...this.orderedItems];
            this.cartService.clearCart();
            this.productService.reduceStock(cartItemsToReduce);
        } catch (err: any) {
            console.error('Payment submission failed:', err);
            let detailedError = 'Failed to submit payment. Please try again.';
            if (err.error?.detail) {
                detailedError = typeof err.error.detail === 'string' ? err.error.detail : JSON.stringify(err.error.detail);
            }
            this.messageService.add({ severity: 'error', summary: 'Error', detail: detailedError });
        } finally {
            this.loading.set(false);
        }
    }

    resetCheckoutForm() {
        this.checkoutForm = {
            fullName: '',
            email: '',
            phoneNumber: '',
            district: '',
            subDistrict: '',
            postalCode: '',
            fullAddress: '',
            additionalInfo: ''
        };
        this.subDistricts = [];
        this.selectedPaymentMethod = null;
        this.bkashTrxId = '';
        this.bkashPhone = '';
        this.showPaymentSection = false;
    }

    goBack() {
        this.router.navigate(['/']);
    }

    continueShopping() {
        this.orderConfirmed = false;
        this.router.navigate(['/']);
    }

    async downloadReceipt() {
        const data = document.getElementById('receipt-content');
        if (!data) return;

        this.loading.set(true);
        // Apply B&W theme for download
        data.classList.add('download-bw');

        try {
            // Wait a small bit for styles to apply
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(data, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const contentDataURL = canvas.toDataURL('image/png');

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [imgWidth, imgHeight]
            });

            pdf.addImage(contentDataURL, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Invoice_${this.getInvoiceNo()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.messageService.add({
                severity: 'error',
                summary: 'Download Failed',
                detail: 'Could not generate receipt PDF. Please try again.'
            });
        } finally {
            data.classList.remove('download-bw');
            this.loading.set(false);
        }
    }
}
