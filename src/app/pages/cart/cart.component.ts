import { Component, signal, ViewChildren, QueryList, OnInit, OnDestroy, Inject, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';
import { InvoiceComponent } from '../../components/invoice/invoice.component';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { lastValueFrom } from 'rxjs';
import { CartService } from '../../core/services/cart/cart.service';
import { OrderService } from '../../core/services/order/order.service';
import { ProductService } from '../../core/services/product/product.service';
import { JourneyService } from '../../core/services/tracking/journey.service';
import { CartItem, CartCombo } from '../../models/cart.model';
import { ComboView } from '../../models/combo.model';
import { districts, District } from '../../data/bangladesh-data';
import { BundlePickerComponent } from '../../components/bundle-picker/bundle-picker.component';

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
        DialogModule,
        ToastModule,
        TagModule,
        InvoiceComponent,
        BundlePickerComponent
    ],
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.scss'],
})
export class CartComponent implements OnInit, OnDestroy {
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
    displayCodConfirmModal = false;
    bkashTrxId = '';
    bkashPhone = '';
    placedOrderId = '';
    placedOrderNumber = '';
    orderConfirmed = false;

    // Cash memo data — saved before cart is cleared
    orderedItems: CartItem[] = [];
    orderFormSnapshot: any = {};
    orderPaymentMethod = '';
    orderDeliveryCharge = 0;
    orderTotal = 0;
    orderDiscount = 0;
    orderCombos: any[] = [];
    orderComboSavings = 0;
    private createdOrderObj: any = null;
    private checkoutIdempotencyKey = '';
    private lastCheckoutSignature = '';

    // Coupon and Quote
    couponInput = '';
    appliedCouponCode = '';
    comboToChange = signal<CartCombo | null>(null);
    changePickerVisible = signal<boolean>(false);

    get quote() {
        return this.cartService.quote();
    }
    get quoteLoading() {
        return this.cartService.quoteLoading();
    }
    get quoteProblems(): string[] {
        return this.quote?.problems || [];
    }
    get subtotalAmount(): number {
        if (this.quote?.subtotal != null) return Number(this.quote.subtotal);
        return this.cartService.subTotal();
    }
    get productDiscountAmount(): number {
        return Number(this.quote?.product_discount || 0);
    }
    get comboSavingsAmount(): number {
        return Number(this.quote?.combo_discount || 0);
    }
    get couponDiscountAmount(): number {
        return Number(this.quote?.coupon?.discount || 0);
    }
    get deliveryAmount(): number {
        if (this.quote?.delivery_charge != null) return Number(this.quote.delivery_charge);
        return this.currentDeliveryCharge;
    }
    get totalAmount(): number {
        if (this.quote?.total != null) return Number(this.quote.total);
        return this.getTotalPrice();
    }

    applyCoupon() {
        const code = this.couponInput.trim();
        if (!code) return;
        this.appliedCouponCode = code;
        this.cartService.fetchQuote(this.checkoutForm.district, this.checkoutForm.phoneNumber, this.appliedCouponCode);
    }

    removeCoupon() {
        this.appliedCouponCode = '';
        this.couponInput = '';
        this.cartService.fetchQuote(this.checkoutForm.district, this.checkoutForm.phoneNumber, null);
    }

    openChangeCombo(combo: CartCombo) {
        this.comboToChange.set(combo);
        this.changePickerVisible.set(true);
    }

    getComboDisplayItems(c: CartCombo): Array<{ product: any; quantity: number }> {
        if (!c || !c.combo) return [];
        if (c.combo.kind === 'mix_and_match') {
            const picks = c.picks || [];
            const countMap = new Map<string, number>();
            for (const pid of picks) {
                countMap.set(pid, (countMap.get(pid) || 0) + 1);
            }
            const result: Array<{ product: any; quantity: number }> = [];
            for (const [pid, count] of countMap.entries()) {
                const matchItem = c.combo.items.find(it => it.product?.id === pid);
                if (matchItem?.product) {
                    result.push({ product: matchItem.product, quantity: count * c.quantity });
                }
            }
            return result.length > 0 ? result : c.combo.items.map(it => ({
                product: it.product,
                quantity: (it.quantity || 1) * c.quantity
            }));
        }

        return c.combo.items.map(it => ({
            product: it.product,
            quantity: (it.quantity || 1) * c.quantity
        }));
    }

    getComboLineTotal(c: CartCombo): number {
        const price = typeof c.combo.combo_price === 'string' ? parseFloat(c.combo.combo_price) : Number(c.combo.combo_price || 0);
        return price * c.quantity;
    }

    onComboChanged(event: { combo: ComboView; picks: string[] }) {
        const current = this.comboToChange();
        if (current) {
            this.cartService.changeComboPicks(current, event.picks);
        }
    }

    // Checkout draft retention in localStorage (10 minutes)
    private readonly CHECKOUT_DRAFT_TTL = 600000;
    private draftClearTimer: any = null;

    // Validation patterns
    emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    postalCodeRegex = /^\d{4}$/;

    constructor(
        public cartService: CartService,
        private orderService: OrderService,
        private productService: ProductService,
        private messageService: MessageService,
        private journeyService: JourneyService,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo(0, 0);
            localStorage.removeItem('karukolpo_checkout_draft');
        }
        this.cartService.handleAbandonedCart();
        this.cartService.fetchQuote(this.checkoutForm.district, this.checkoutForm.phoneNumber, this.appliedCouponCode);
    }

    onFullNameChange(val: string) {
        this.checkoutForm.fullName = (val || '').replace(/^\s+/, '');
    }

    saveFormState() {
        // Form state retained in-memory
    }

    clearCheckoutDraft(clearCart: boolean = false) {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem('karukolpo_checkout_draft');
        }
        this.resetIdempotencyKey();
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
        this.showPaymentSection = false;
        this.selectedPaymentMethod = null;

        if (clearCart && this.cartService.cart().length > 0) {
            this.cartService.clearAbandonClock();
            this.cartService.clearCart();
        }
    }

    loadSubDistricts(districtName: string) {
        const selectedDistrict = this.districts.find(d => d.name === districtName);
        this.subDistricts = selectedDistrict ? selectedDistrict.subDistricts : [];
        if (districtName === 'Tangail') {
            this.currentDeliveryCharge = 70;
            this.deliveryLocation = 'Inside Dhaka';
        } else {
            this.currentDeliveryCharge = 130;
            this.deliveryLocation = 'Outside Dhaka';
        }
    }

    ngOnDestroy() {
        if (this.draftClearTimer) {
            clearTimeout(this.draftClearTimer);
            this.draftClearTimer = null;
        }
        this.armAbandonClockIfActive();
    }

    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload() {
        this.armAbandonClockIfActive();
    }

    private armAbandonClockIfActive() {
        if (!this.showPaymentSection || this.orderConfirmed || this.cartService.cart().length === 0) {
            return;
        }
        this.cartService.markCheckoutLeft();
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
        this.loadSubDistricts(districtName);
        this.checkoutForm.subDistrict = '';
        this.saveFormState();
        this.cartService.fetchQuote(districtName, this.checkoutForm.phoneNumber, this.appliedCouponCode);
    }

    onPhoneNumberChange(val: string) {
        this.checkoutForm.phoneNumber = val;
        this.cartService.fetchQuote(this.checkoutForm.district, val, this.appliedCouponCode);
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
        if (this.cartService.isEmpty()) {
            this.messageService.add({ severity: 'warn', summary: 'Cart Empty', detail: 'Add items to cart first' });
            return;
        }

        if (this.quoteProblems.length > 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Action Required',
                detail: this.quoteProblems[0]
            });
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
        this.journeyService.track('begin_checkout');
        this.selectedPaymentMethod = null;
        this.bkashPhone = this.checkoutForm.phoneNumber;
        this.placedOrderId = '';
        this.saveFormState();

        // Scroll to payment section
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }

    private getOrCreateIdempotencyKey(): string {
        const signature = JSON.stringify({
            phone: this.checkoutForm.phoneNumber,
            address: this.checkoutForm.fullAddress,
            items: this.cartService.cart().map(i => ({ id: i.product?.id, q: i.quantity })),
            combos: this.cartService.combos().map(c => ({ id: c.combo.id, q: c.quantity, picks: c.picks })),
            coupon: this.appliedCouponCode
        });
        if (!this.checkoutIdempotencyKey || this.lastCheckoutSignature !== signature) {
            this.checkoutIdempotencyKey = crypto.randomUUID();
            this.lastCheckoutSignature = signature;
        }
        return this.checkoutIdempotencyKey;
    }

    private resetIdempotencyKey() {
        this.checkoutIdempotencyKey = '';
        this.lastCheckoutSignature = '';
    }

    private prepareOrderData(paymentMethod: 'COD' | 'bKash'): any {
        return {
            ...this.checkoutForm,
            items: this.cartService.cart(),
            combos: this.cartService.combos().map(c => ({
                combo_id: c.combo.id,
                quantity: c.quantity,
                ...(c.picks && c.picks.length ? { picks: c.picks } : {})
            })),
            couponCode: this.appliedCouponCode || undefined,
            totalAmount: this.totalAmount,
            status: 'Pending' as 'Pending',
            paymentMethod: paymentMethod,
            deliveryLocation: this.deliveryLocation,
            deliveryCharge: this.deliveryAmount,
            orderDate: new Date()
        };
    }

    private saveCashMemoData(paymentMethod: string) {
        if (this.createdOrderObj && this.createdOrderObj.items && this.createdOrderObj.items.length > 0) {
            const products = [
                ...this.cartService.cart().map(item => item.product),
                ...this.cartService.combos().flatMap(c => c.combo.items.map(item => item.product))
            ];
            const namesById = new Map(
                products.filter(product => product.name?.trim())
                    .map(product => [String(product.id), product.name] as const)
            );

            this.orderedItems = this.createdOrderObj.items.map((item: any) => {
                const id = item.product?.id || item.product_id;
                if (item.product?.name?.trim() || item.name?.trim() || item.product?.title?.trim()) {
                    return item;
                }
                const name = namesById.get(String(id));
                return name
                    ? { ...item, product: { ...item.product, name } }
                    : item;
            });
        } else {
            const fallbackItems = [...this.cartService.cart()];
            for (const c of this.cartService.combos()) {
                for (const it of c.combo.items) {
                    fallbackItems.push({
                        product: it.product,
                        quantity: (it.quantity || 1) * c.quantity,
                        unit_price: it.product.effective_price ?? it.product.price,
                        price_at_purchase: it.product.effective_price ?? it.product.price,
                        order_combo_id: c.combo.id
                    } as any);
                }
            }
            this.orderedItems = fallbackItems;
        }
        this.orderCombos = this.createdOrderObj?.combos || this.cartService.combos().map(c => ({ ...c.combo, quantity: c.quantity, picks: c.picks }));
        this.orderComboSavings = this.createdOrderObj?.combo_savings ?? this.comboSavingsAmount;
        this.orderFormSnapshot = { ...this.checkoutForm };
        this.orderPaymentMethod = paymentMethod;
        this.orderDeliveryCharge = this.createdOrderObj?.deliveryCharge ?? this.deliveryAmount;
        this.orderTotal = this.createdOrderObj?.totalAmount ?? this.totalAmount;
        this.orderDiscount = this.createdOrderObj?.discountAmount ?? (this.productDiscountAmount + this.couponDiscountAmount);
    }

    selectPaymentMethod(method: 'COD' | 'bKash') {
        this.selectedPaymentMethod = method;
        
        if (method === 'COD') {
            this.displayCodConfirmModal = true;
        }
    }

    cancelCOD() {
        this.displayCodConfirmModal = false;
        this.selectedPaymentMethod = null;
    }

    async proceedWithCOD() {
        this.displayCodConfirmModal = false;
        await this.confirmCOD();
    }

    async confirmCOD() {
        this.loading.set(true);
        const orderData = this.prepareOrderData('COD');

        try {
            const order = await lastValueFrom(this.orderService.createOrder(orderData, this.getOrCreateIdempotencyKey()));
            this.createdOrderObj = order;
            this.placedOrderId = order.id || '';
            this.placedOrderNumber = order.orderNumber || this.placedOrderId;
            this.messageService.add({ severity: 'success', summary: 'Order Confirmed', detail: 'Your COD order has been placed successfully.' });

            this.saveCashMemoData('Cash on Delivery');
            this.orderConfirmed = true;
            if (isPlatformBrowser(this.platformId)) {
                window.scrollTo(0, 0);
            }

            this.cartService.clearAbandonClock();
            this.cartService.clearCart();
            this.clearCheckoutDraft();
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

        const cleanTrx = this.bkashTrxId.toUpperCase().trim();
        if (!/^[A-Z0-9]{10}$/.test(cleanTrx)) {
            this.messageService.add({
                severity: 'error',
                summary: 'Invalid TrxID',
                detail: 'bKash Transaction ID must be exactly 10 alphanumeric characters (e.g. BL99K7M80J)'
            });
            return;
        }

        this.loading.set(true);

        if (!this.placedOrderId) {
            const orderData = this.prepareOrderData('bKash');
            try {
                const order = await lastValueFrom(this.orderService.createOrder(orderData, this.getOrCreateIdempotencyKey()));
                this.createdOrderObj = order;
                this.placedOrderId = order.id || '';
                this.placedOrderNumber = order.orderNumber || this.placedOrderId;
            } catch (err) {
                console.error('bKash Order creation failed', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create order. Please try again.' });
                this.loading.set(false);
                return;
            }
        }

        const oid = this.placedOrderId;
        let cleanPhone = this.bkashPhone.replace(/\D/g, '');
        if (cleanPhone.length > 11) {
            cleanPhone = cleanPhone.slice(-11);
        }

        const payload = {
            transaction_id: cleanTrx,
            sender_phone: cleanPhone
        };

        try {
            await lastValueFrom(this.orderService.submitTrx(oid, payload, this.checkoutForm.phoneNumber));
            this.messageService.add({ severity: 'success', summary: 'Payment Submitted', detail: 'Your payment has been submitted for verification.' });

            this.saveCashMemoData('bKash');
            this.orderConfirmed = true;
            if (isPlatformBrowser(this.platformId)) {
                window.scrollTo(0, 0);
            }

            this.cartService.clearAbandonClock();
            this.cartService.clearCart();
            this.clearCheckoutDraft();
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

    copyBkashNumber(num: string) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(num).then(() => {
                this.messageService.add({
                    severity: 'info',
                    summary: 'Copied',
                    detail: 'bKash number copied to clipboard!'
                });
            }).catch(() => {});
        }
    }

    goBack() {
        this.router.navigate(['/']);
    }

    continueShopping() {
        this.orderConfirmed = false;
        this.router.navigate(['/']);
    }
}
