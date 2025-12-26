import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DataViewModule } from 'primeng/dataview';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { Product } from '../../models/product.model';
import { CartItem } from '../../models/cart.model';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { GalleriaModule } from 'primeng/galleria';
import { ContactService } from '../../services/contact.service';
import { DropdownModule } from 'primeng/dropdown';
import { districts, District } from '../../data/bangladesh-data';
import { ThemeService } from '../../services/theme.service';
import { PaymentService } from '../../services/payment.service';
import { DeliveryService } from '../../services/delivery.service';
import { SiteConfigService } from '../../services/site-config.service';
import { RadioButtonModule } from 'primeng/radiobutton';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    DataViewModule,
    InputNumberModule,
    FormsModule,
    InputTextModule,
    InputTextareaModule,
    ToastModule,
    GalleriaModule,
    ProgressSpinnerModule,
    DropdownModule,
    RadioButtonModule
  ],
  providers: [MessageService],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  displayProductModal = false;
  displayCheckoutModal = false;
  displayOrderSuccessModal = false;
  selectedProduct: Product | null = null;
  activeIndex: number = 0;

  checkoutForm = {
    fullName: '',
    email: '',
    phoneNumber: '',
    district: '',
    subDistrict: '',
    postalCode: '',
    fullAddress: ''
  };

  // Delivery Logic
  deliveryLocation: 'Inside Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
  currentDeliveryCharge = 0;
  deliveryCharges = { insideDhaka: 60, outsideDhaka: 120 };

  districts: District[] = districts;
  subDistricts: string[] = [];

  placedOrderId = '';
  landingPageImage = signal<string>('assets/landing-bg.jpg'); // Default, can be updated by admin
  landingPageTagline = signal<string>('Authentic Bangladeshi Handcrafts');

  responsiveOptions: any[] = [
    {
      breakpoint: '1024px',
      numVisible: 5
    },
    {
      breakpoint: '768px',
      numVisible: 3
    },
    {
      breakpoint: '560px',
      numVisible: 1
    }
  ];

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private messageService: MessageService,
    public contactService: ContactService,
    public themeService: ThemeService,
    public siteConfigService: SiteConfigService,
    private paymentService: PaymentService,
    private deliveryService: DeliveryService
  ) { }

  openPaymentModal(orderId: string) {
    // Deprecated: Payment flow integrated into checkout
  }

  displayPaymentModal = false; // Kept to avoid template errors during transition if any
  selectedPaymentMethod: 'COD' | 'bKash' | null = null;
  bkashQrCodeInModal: string | null = null;

  // New combined state
  isPaymentSelected = false;
  bkashNumber = '';

  selectPaymentMethod(method: 'COD' | 'bKash') {
    this.selectedPaymentMethod = method;
    this.isPaymentSelected = true;
    if (method === 'bKash') {
      this.bkashQrCodeInModal = this.paymentService.getQrCode();
    } else {
      this.bkashNumber = ''; // Reset if switched to COD
    }
  }

  // Replaces confirmPayment and integration into placeOrder
  get isFormAndPaymentValid(): boolean {
    // Basic form valid AND payment selected
    let valid = this.isCheckoutFormValid && this.isPaymentSelected;

    // If bKash, also need valid bKash number
    if (this.selectedPaymentMethod === 'bKash') {
      valid = valid && !!this.bkashNumber && this.phoneRegex.test(this.bkashNumber);
    }

    return valid;
  }

  ngOnInit() {
    this.loadProducts();
    this.loadLandingPageConfig();
    this.loadDeliveryCharges();
  }

  loadDeliveryCharges() {
    this.deliveryCharges = this.deliveryService.getCharges();
    this.updateDeliveryCharge();
  }

  updateDeliveryCharge() {
    this.currentDeliveryCharge = this.deliveryLocation === 'Inside Dhaka'
      ? this.deliveryCharges.insideDhaka
      : this.deliveryCharges.outsideDhaka;
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadLandingPageConfig() {
    const load = () => {
      const config = localStorage.getItem('landingConfig');
      if (config) {
        const parsed = JSON.parse(config);
        this.landingPageImage.set(parsed.image || 'assets/landing-bg.jpg');
        this.landingPageTagline.set(parsed.tagline || 'Authentic Bangladeshi Handcrafts');
      }
    };
    load(); // Initial load
    window.addEventListener('storage', load); // Listen for updates
  }

  showProductDetails(product: Product) {
    this.selectedProduct = product;
    this.displayProductModal = true;
  }

  addToCart(product: Product) {
    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity++;
    } else {
      this.cart.update(items => [...items, { product, quantity: 1 }]);
    }
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `${product.name} added to cart` });
    this.displayProductModal = false;
  }

  updateQuantity(item: CartItem, change: number) {
    item.quantity += change;
    if (item.quantity <= 0) {
      this.cart.update(items => items.filter(i => i !== item));
    }
  }

  getSubTotal(): number {
    return this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }

  getTotalPrice(): number {
    return this.getSubTotal() + this.currentDeliveryCharge;
  }

  onDistrictChange(event: any) {
    const selectedDistrict = this.districts.find(d => d.name === event.value);
    this.subDistricts = selectedDistrict ? selectedDistrict.subDistricts : [];
    this.checkoutForm.subDistrict = '';
  }

  // Regex Patterns for Template Binding
  emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/; // Bangladeshi Phone Number
  postalCodeRegex = /^\d{4}$/; // Exact 4 digits

  get isCheckoutFormValid(): boolean {
    const { fullName, email, phoneNumber, district, postalCode, fullAddress, subDistrict } = this.checkoutForm;

    // Basic existence check
    const basicValidation = fullName && email && phoneNumber && district && postalCode && fullAddress;

    // Sub-district check
    const subDistrictValidation = this.subDistricts.length > 0 ? !!subDistrict : true; // Optional if no sub-districts

    const isEmailValid = this.emailRegex.test(email);
    const isPhoneValid = this.phoneRegex.test(phoneNumber);
    const isPostalCodeValid = this.postalCodeRegex.test(postalCode);

    const isValid = !!(basicValidation && subDistrictValidation && isEmailValid && isPhoneValid && isPostalCodeValid);

    return isValid;
  }

  openCheckout() {
    if (this.cart().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Cart is Empty', detail: 'Add items to cart first' });
      return;
    }
    this.displayCheckoutModal = true;
  }

  placeOrder() {
    // 1. Check Payment Method
    if (!this.selectedPaymentMethod) {
      this.messageService.add({ severity: 'error', summary: 'Missing Payment Method', detail: 'Please select bKash or Cash On Delivery.' });
      return;
    }

    // 2. Check bKash Number if bKash selected
    if (this.selectedPaymentMethod === 'bKash') {
      if (!this.bkashNumber) {
        this.showError('bKash Account Number is required');
        return;
      }
      if (!this.phoneRegex.test(this.bkashNumber)) {
        this.showError('Invalid bKash Number');
        return;
      }
    }

    // 3. Check Form Validity manually for better feedback
    const { fullName, email, phoneNumber, district, postalCode, fullAddress, subDistrict } = this.checkoutForm;

    if (!fullName) return this.showError('Full Name is required');
    if (!email) return this.showError('Email is required');
    if (!this.emailRegex.test(email)) return this.showError('Invalid Email Address');
    if (!phoneNumber) return this.showError('Phone Number is required');
    if (!this.phoneRegex.test(phoneNumber)) return this.showError('Invalid Phone Number (e.g., 017...)');
    if (!district) return this.showError('District is required');
    if (this.subDistricts.length > 0 && !subDistrict) return this.showError('Sub-District is required');
    if (!postalCode) return this.showError('Postal Code is required');
    if (!this.postalCodeRegex.test(postalCode)) return this.showError('Invalid Postal Code (4 digits)');
    if (!fullAddress) return this.showError('Full Address is required');

    // Proceed if all valid
    const order = {
      ...this.checkoutForm,
      items: this.cart(),
      totalAmount: this.getTotalPrice(),
      status: 'Pending' as const,
      paymentMethod: this.selectedPaymentMethod,
      // Auto-update to Paid if bkash
      paymentStatus: (this.selectedPaymentMethod === 'bKash' ? 'Paid' : 'Pending') as 'Pending' | 'Paid',
      bkashNumber: this.selectedPaymentMethod === 'bKash' ? this.bkashNumber : undefined,
      deliveryLocation: this.deliveryLocation,
      deliveryCharge: this.currentDeliveryCharge,
      orderDate: new Date()
    };

    try {
      this.orderService.createOrder(order as any).subscribe({
        next: (orderId) => {
          console.log('Order created successfully:', orderId);
          this.placedOrderId = orderId;
          this.displayCheckoutModal = false;
          this.displayOrderSuccessModal = true;
          this.cart.set([]);
          this.resetCheckoutForm();
          this.selectedPaymentMethod = null;
          this.isPaymentSelected = false;
          this.bkashNumber = '';

          // Reduce stock
          this.productService.reduceStock(this.cart());


        },
        error: (err) => {
          console.error('Order creation failed:', err);
          this.showError('Failed to place order. Please try again.');
        }
      });
    } catch (e: any) {
      console.error('Exception in placeOrder:', e);
      this.showError('Error: ' + (e.message || e));
    }
  }

  showError(msg: string) {
    this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: msg });
  }

  resetCheckoutForm() {
    this.checkoutForm = {
      fullName: '',
      email: '',
      phoneNumber: '',
      district: '',
      subDistrict: '',
      postalCode: '',
      fullAddress: ''
    };
  }

  isOutOfStock(product: Product): boolean {
    if (product.manualStockStatus === 'OUT_OF_STOCK') return true;
    if (product.manualStockStatus === 'IN_STOCK') return false;
    return (product.stock || 0) <= 0;
  }
}
