import {
    ChangeDetectionStrategy,
    Component,
    HostListener,
    OnDestroy,
    QueryList,
    ViewChildren,
    effect,
    input,
    signal
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { lastValueFrom } from 'rxjs';
import { OrderService } from '../../core/services/order/order.service';
import { CartService } from '../../core/services/cart/cart.service';
import { PaymentService } from '../../core/services/payment/payment.service';
import { ProductService } from '../../core/services/product/product.service';
import { GtagService } from '../../core/services/gtag/gtag.service';
import { District, districts } from '../../data/bangladesh-data';
import { CartItem } from '../../models/cart.model';
import { Order } from '../../models/order.model';

@Component({
    selector: 'app-home-checkout-modals',
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        DropdownModule,
        InputTextModule,
        TextareaModule,
        TagModule,
        CurrencyPipe,
        DatePipe
    ],
    templateUrl: './home-checkout-modals.component.html',
    styleUrls: ['./home-checkout-modals.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeCheckoutModalsComponent implements OnDestroy {
    checkoutRequested = input(false);

    loading = signal<boolean>(false);
    displayCheckoutModal = false;
    displayOrderSuccessModal = false;
    displayPaymentMethodModal = false;
    displayPaymentSuccessModal = false;
    displayTrackOrderModal = false;
    displayFinalSuccessModal = false;
    selectedPaymentMethod: 'COD' | 'bKash' | null = null;
    isPaymentSelected = false;
    bkashTrxId = '';
    bkashPhone = '';
    trackPhone = '';
    trackedOrders: Order[] = [];
    trackingLoading = false;
    hasSearched = false;
    deliveryLocation: 'Inside Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
    currentDeliveryCharge = 0;
    districts: District[] = districts;
    subDistricts: string[] = [];
    placedOrderId = '';
    placedOrderNumber = '';
    currentPaymentId: number | null = null;
    transactionId = '';
    emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/; // Bangladeshi Phone Number
    postalCodeRegex = /^\d{4}$/; // Exact 4 digits

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

    constructor(
        private orderService: OrderService,
        private messageService: MessageService,
        private paymentService: PaymentService,
        private productService: ProductService,
        public cartService: CartService,
        private gtagService: GtagService
    ) {
        effect(() => {
            if (this.checkoutRequested()) {
                this.openCheckout();
            }
        });
    }

    ngOnDestroy() {
        this.armAbandonClockIfActive();
    }

    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload() {
        this.armAbandonClockIfActive();
    }

    private armAbandonClockIfActive() {
        if (!this.displayOrderSuccessModal || this.cartService.cart().length === 0) {
            return;
        }
        this.cartService.markCheckoutLeft();
    }

    // Replaces confirmPayment and integration into placeOrder
    get isFormAndPaymentValid(): boolean {
        let valid = this.isCheckoutFormValid && this.isPaymentSelected;
        return valid;
    }

    get isCheckoutFormValid(): boolean {
        const { fullName, email, phoneNumber, district, postalCode, fullAddress, subDistrict } = this.checkoutForm;

        // Basic existence check (Removed postalCode form strict requirements)
        const basicValidation = fullName && email && phoneNumber && district && fullAddress;

        // Sub-district check
        const subDistrictValidation = this.subDistricts.length > 0 ? !!subDistrict : true;

        const isEmailValid = this.emailRegex.test(email);
        const isPhoneValid = this.phoneRegex.test(phoneNumber);
        // Postal code is optional, but if present must be valid
        const isPostalCodeValid = !postalCode || this.postalCodeRegex.test(postalCode);

        const isValid = !!(basicValidation && subDistrictValidation && isEmailValid && isPhoneValid && isPostalCodeValid);

        return isValid;
    }

    openCheckout() {
        if (this.cartService.cart().length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Cart is Empty', detail: 'Add items to cart first' });
            return;
        }
        // Refresh cart products before showing checkout to ensure latest price/stock
        this.cartService.refreshCartProducts();

        // Reset payment method to default to ensure modal logic works
        this.selectedPaymentMethod = null;
        this.displayCheckoutModal = true;
    }

    onDistrictChange(event: any) {
        const districtName = event.value;
        const selectedDistrict = this.districts.find(d => d.name === districtName);
        this.subDistricts = selectedDistrict ? selectedDistrict.subDistricts : [];
        this.checkoutForm.subDistrict = '';

        // Automated Delivery Charge Calculation
        if (districtName === 'Tangail') {
            this.currentDeliveryCharge = 70;
            this.deliveryLocation = 'Inside Dhaka';
        } else {
            this.currentDeliveryCharge = 130;
            this.deliveryLocation = 'Outside Dhaka';
        }
    }

    updateQuantity(item: CartItem, change: number) {
        this.cartService.updateQuantity(item, change);
    }

    getSubTotal(): number {
        return this.cartService.subTotal();
    }

    getTotalPrice(): number {
        return this.getSubTotal() + this.currentDeliveryCharge;
    }

    placeOrder() {
        if (!this.isCheckoutFormValid) {
            this.messageService.add({
                life: 2000,
                severity: 'error',
                summary: 'Validation Error',
                detail: 'Please fill all required fields correctly.'
            });

            // Mark all fields as touched to trigger UI validation messages
            if (this.formControls) {
                this.formControls.forEach(control => {
                    control.control.markAsTouched();
                });
            }
            return;
        }

        // Close the checkout modal and open the payment selection modal
        this.displayCheckoutModal = false;
        this.displayOrderSuccessModal = true;
        this.selectedPaymentMethod = null;
        this.bkashPhone = this.checkoutForm.phoneNumber;
        // Reset placedOrderId to ensure a new order is created
        this.placedOrderId = '';
    }

    trackOrder() {
        if (!this.trackPhone) {
            this.showError('Please enter a phone number or order number');
            return;
        }

        const input = this.trackPhone.trim().toUpperCase();
        this.trackingLoading = true;
        this.hasSearched = true;

        if (input.startsWith('ORD-')) {
            // Track by order number
            this.orderService.trackOrderByNumber(input).subscribe({
                next: (order) => {
                    this.trackedOrders = order ? [order] : [];
                    this.trackingLoading = false;
                },
                error: (err) => {
                    console.error('Tracking by number failed', err);
                    this.trackedOrders = [];
                    this.trackingLoading = false;
                    this.showError('Order number not found.');
                }
            });
        } else {
            // Track by phone
            this.orderService.trackOrdersByPhone(this.trackPhone).subscribe({
                next: (orders) => {
                    this.trackedOrders = orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                    this.trackingLoading = false;
                },
                error: (err) => {
                    console.error('Tracking failed', err);
                    this.trackedOrders = [];
                    this.trackingLoading = false;
                }
            });
        }
    }

    openPaymentForOrder(orderId: string | undefined) {
        if (!orderId) {
            this.showError('Invalid Order ID');
            return;
        }
        this.placedOrderId = orderId;
        this.displayTrackOrderModal = false;
        this.displayPaymentMethodModal = true;
        this.selectedPaymentMethod = null;
        this.transactionId = '';
        this.currentPaymentId = null;
    }

    processPayment() {
        if (!this.selectedPaymentMethod) {
            this.showError('Please select a payment method');
            return;
        }

        if (this.selectedPaymentMethod === 'bKash') {
            if (!this.transactionId) {
                this.showError('Transaction ID is required');
                return;
            }
        }

        const oid = this.placedOrderId;

        // Helper to handle confirmation
        const handleConfirmation = (paymentId: number) => {
            if (this.selectedPaymentMethod === 'bKash') {
                const trxId = this.transactionId.trim();

                if (!trxId) {
                    this.showError('Transaction ID is required');
                    return;
                }

                this.paymentService.confirmPayment(oid, paymentId, trxId).subscribe({
                    next: () => {
                        this.messageService.add({
                            life: 2000,
                            severity: 'success',
                            summary: 'Payment Submitted',
                            detail: 'Waiting for admin verification.'
                        });
                        this.displayPaymentMethodModal = false;
                        this.displayPaymentSuccessModal = true;
                    },
                    error: (err: any) => {
                        console.error('Payment confirmation failed', err);

                        let errorMsg = 'Failed to confirm payment. Please check Transaction ID.';
                        if (err.error && err.error.detail) {
                            if (typeof err.error.detail === 'string') {
                                errorMsg = err.error.detail;
                            } else if (Array.isArray(err.error.detail)) {
                                errorMsg = err.error.detail.map((e: any) => e.msg).join(', ');
                            }
                        }

                        this.showError(errorMsg);
                    }
                });
            } else {
                // COD - Just finish
                this.messageService.add({
                    life: 2000,
                    severity: 'success',
                    summary: 'COD Selected',
                    detail: 'Waiting for admin verification.'
                });
                this.displayPaymentMethodModal = false;
                this.displayPaymentSuccessModal = true;
            }
        };

        // If we already have a payment ID for this session, skip creation
        if (this.currentPaymentId) {
            handleConfirmation(this.currentPaymentId);
            return;
        }

        // 1. Create Payment
        const methodToSend = this.selectedPaymentMethod === 'bKash' ? 'bkash' : 'cod';

        this.paymentService.createPayment(oid, methodToSend).subscribe({
            next: (payment: any) => {
                if (payment && payment.id) {
                    this.currentPaymentId = payment.id;
                    handleConfirmation(payment.id);
                } else {
                    console.error('Payment created but no ID returned', payment);
                    this.showError('Payment initialization failed. Please try again.');
                }
            },
            error: (err: any) => {
                console.error('Payment creation failed', err);
                this.showError('Failed to initiate payment. Please try again.');
            }
        });
    }

    showError(msg: any, status?: number) {
        let detail = msg;
        if (typeof msg === 'object' && msg !== null) {
            try {
                detail = JSON.stringify(msg);
            } catch (e) {
                detail = String(msg);
            }
        }
        const summary = status ? `Error (${status})` : 'Validation Error';
        this.messageService.add({ severity: 'error', summary: summary, detail: detail });
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
        this.isPaymentSelected = false;
        this.selectedPaymentMethod = null;
        this.bkashTrxId = '';
        this.bkashPhone = '';
    }

    async selectPaymentMethod(method: 'COD' | 'bKash') {
        this.selectedPaymentMethod = method;
        this.isPaymentSelected = true;

        if (method === 'COD') {
            await this.confirmCOD();
        }
    }

    async confirmCOD() {
        this.loading.set(true);
        const orderData = this.prepareOrderData('COD');

        try {
            const order = await lastValueFrom(this.orderService.createOrder(orderData));
            this.placedOrderId = order.id || '';
            this.placedOrderNumber = order.orderNumber || this.placedOrderId;

            // Since it's COD, we can directly show success
            this.messageService.add({
                life: 2000,
                severity: 'success',
                summary: 'Order Confirmed',
                detail: 'Your COD order has been placed successfully.'
            });
            this.displayOrderSuccessModal = false;
            this.displayFinalSuccessModal = true;

            // Clear cart and reset
            const cartItemsToReduce = [...this.cartService.cart()];
            this.gtagService.trackPurchase(this.placedOrderNumber || this.placedOrderId, this.getTotalPrice(), cartItemsToReduce);
            this.cartService.clearAbandonClock();
            this.cartService.clearCart();
            this.productService.reduceStock(cartItemsToReduce);
            this.resetCheckoutForm();
        } catch (err) {
            console.error('COD Order creation failed', err);
            this.showError('Failed to place order. Please try again.');
        } finally {
            this.loading.set(false);
        }
    }

    async submitBkashPayment() {
        if (!this.bkashTrxId || !this.bkashPhone) {
            this.showError('Transaction ID and Phone Number are required');
            return;
        }

        this.loading.set(true);

        // Step 1: Create the order if it doesn't exist yet
        if (!this.placedOrderId) {
            const orderData = this.prepareOrderData('bKash');
            try {
                const order = await lastValueFrom(this.orderService.createOrder(orderData));
                this.placedOrderId = order.id || '';
                this.placedOrderNumber = order.orderNumber || this.placedOrderId;
            } catch (err) {
                console.error('bKash Order creation failed', err);
                this.showError('Failed to create order before payment. Please try again.');
                this.loading.set(false);
                return;
            }
        }

        const oid = this.placedOrderId;

        // Sanitize phone number
        let cleanPhone = this.bkashPhone.replace(/\D/g, '');
        if (cleanPhone.length > 11) {
            cleanPhone = cleanPhone.slice(-11);
        }

        const payload = {
            transaction_id: this.bkashTrxId.trim(),
            sender_phone: cleanPhone
        };

        // Step 2: Submit the transaction details
        try {
            await lastValueFrom(this.orderService.submitTrx(oid, payload, this.checkoutForm.phoneNumber));

            // Success Logic
            this.messageService.add({
                life: 2000,
                severity: 'success',
                summary: 'Payment Submitted',
                detail: 'Your payment has been submitted for verification.'
            });
            this.displayOrderSuccessModal = false;
            this.displayFinalSuccessModal = true;

            // Clear cart and reset
            const cartItemsToReduce = [...this.cartService.cart()];
            this.gtagService.trackPurchase(this.placedOrderNumber || this.placedOrderId, this.getTotalPrice(), cartItemsToReduce);
            this.cartService.clearAbandonClock();
            this.cartService.clearCart();
            this.productService.reduceStock(cartItemsToReduce);
            this.resetCheckoutForm();
        } catch (err: any) {
            console.error('Payment submission failed:', err);
            let detailedError = 'Failed to submit payment. Please check your Transaction ID and try again.';
            if (err.error?.detail) {
                detailedError = typeof err.error.detail === 'string' ? err.error.detail : JSON.stringify(err.error.detail);
            }
            this.showError(detailedError, err.status);
            // Note: We leave placedOrderId so the user can retry submitting the transaction
        } finally {
            this.loading.set(false);
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
}
