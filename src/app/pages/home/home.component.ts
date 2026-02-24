import { Component, OnInit, OnDestroy, signal, ViewChildren, QueryList, ChangeDetectionStrategy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { CommonModule, CurrencyPipe, DatePipe, NgOptimizedImage } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { forkJoin, map, catchError, of, lastValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { DataViewModule } from 'primeng/dataview';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule, NgModel } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
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
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SkeletonModule } from 'primeng/skeleton';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { Order } from '../../models/order.model';
import { CartService } from '../../services/cart.service';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    DataViewModule,
    InputNumberModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    GalleriaModule,
    ProgressSpinnerModule,
    DropdownModule,
    RadioButtonModule,
    SkeletonModule,
    BadgeModule,
    TagModule,
    TooltipModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    SafeHtmlPipe,
    NgOptimizedImage
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private storageListener: (() => void) | null = null;
  products = signal<Product[]>([]);
  // cart = signal<CartItem[]>([]); // Removed, using CartService
  loading = signal<boolean>(false);
  displayProductModal = false;
  displayCheckoutModal = false;
  displayOrderSuccessModal = false;
  displayPaymentMethodModal = false;
  displayPaymentSuccessModal = false;
  displayTrackOrderModal = false;

  selectedProduct: Product | null = null;
  activeIndex: number = 0;

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

  // Payment Flow State
  displayPaymentModal = false;
  selectedPaymentMethod: 'COD' | 'bKash' | null = null;
  bkashTrxId = '';
  bkashPhone = '';
  displayFinalSuccessModal = false;

  // Track Order
  trackPhone = '';
  trackedOrders: Order[] = [];
  trackingLoading = false;
  hasSearched = false;

  // Delivery Logic
  deliveryLocation: 'Inside Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
  currentDeliveryCharge = 0;

  districts: District[] = districts;
  subDistricts: string[] = [];

  placedOrderId = '';
  currentPaymentId: number | null = null;
  transactionId = '';

  landingPageImage = signal<string>('assets/landing-bg.jpg');
  landingPageTagline = signal<string>('Authentic Bangladeshi Handcrafts');

  categoryImages: { [key: string]: string } = {
    'Prodip': 'assets/categories/prodip.png',
    'Protima': 'assets/categories/protima.png',
    'Shora': 'assets/categories/shora.png',
    'Home Decor': 'assets/categories/homedecor.png',
    'Mirror': 'assets/categories/mirror.png',
    'Sharee': 'assets/categories/sharee.png'
  };

  getCategoryImage(categoryName: string): string {
    return this.categoryImages[categoryName] || 'assets/category-default.jpg';
  }

  categories = this.categoryService.categories;
  selectedCategory: Category | null = null;
  filteredProducts = signal<Product[]>([]);
  dropdownOpen = false;

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
    private titleService: Title,
    private metaService: Meta,
    public contactService: ContactService,
    public themeService: ThemeService,
    public siteConfigService: SiteConfigService,
    private paymentService: PaymentService,
    private deliveryService: DeliveryService,
    private categoryService: CategoryService,
    public cartService: CartService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  openPaymentModal(orderId: string) {
    // Deprecated
  }

  isPaymentSelected = false;

  selectPaymentMethod(method: 'COD' | 'bKash') {
    this.selectedPaymentMethod = method;
    this.isPaymentSelected = true;
  }

  // Replaces confirmPayment and integration into placeOrder
  get isFormAndPaymentValid(): boolean {
    // Basic form valid AND payment selected
    let valid = this.isCheckoutFormValid && this.isPaymentSelected;
    return valid;
  }

  ngOnInit() {
    this.loadProducts();
    this.loadLandingPageConfig();
    this.loadDeliveryCharges();

    // Check for checkout query param
    this.route.queryParams.subscribe(params => {
      if (params['checkout'] === 'true') {
        // Wait a bit for products/cart to load if needed, but cart is local storage so it's fast
        setTimeout(() => {
          this.openCheckout();
          // Clear query param so refresh doesn't reopen
          this.router.navigate([], {
            queryParams: {
              'checkout': null
            },
            queryParamsHandling: 'merge'
          });
        }, 100);
      }
    });

    this.updateSeo();
  }

  updateSeo() {
    this.titleService.setTitle('Karukolpo | Premium Handmade Crafts');
    this.metaService.updateTag({ name: 'description', content: 'Karukolpo offers a wide range of premium handmade crafts and products. Discover unique collections and hot deals.' });
    this.metaService.updateTag({ property: 'og:title', content: 'Karukolpo | Premium Handmade Crafts' });
    this.metaService.updateTag({ property: 'og:image', content: this.landingPageImage() });
  }

  loadDeliveryCharges() {
    // Initial default set to 0 as requested
    this.currentDeliveryCharge = 0;
  }

  onDistrictChange(event: any) {
    const districtName = event.value;
    const selectedDistrict = this.districts.find(d => d.name === districtName);
    this.subDistricts = selectedDistrict ? selectedDistrict.subDistricts : [];
    this.checkoutForm.subDistrict = '';

    // Automated Delivery Charge Calculation
    if (districtName === 'Tangail') {
      this.currentDeliveryCharge = 70;
      this.deliveryLocation = 'Inside Dhaka'; // Mapping Tangail to 'Inside Dhaka' logic or just updating charge
    } else {
      this.currentDeliveryCharge = 130;
      this.deliveryLocation = 'Outside Dhaka';
    }
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.filteredProducts.set(products);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching products', err);
        this.loading.set(false);
      }
    });
  }

  loadLandingPageConfig() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const load = () => {
      const config = localStorage.getItem('landingConfig');
      if (config) {
        const parsed = JSON.parse(config);
        this.landingPageTagline.set(parsed.tagline || 'Authentic Bangladeshi Handcrafts');
      }
    };
    load(); // Initial load
    this.storageListener = load;
    window.addEventListener('storage', load);
  }

  ngOnDestroy() {
    if (this.storageListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('storage', this.storageListener);
    }
  }

  showProductDetails(product: Product) {
    // Navigate to product details page instead of modal
    this.router.navigate(['/products', product.id]);
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product);
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

  getTotalCartItems(): number {
    return this.cartService.totalItems();
  }



  // Regex Patterns for Template Binding
  emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/; // Bangladeshi Phone Number
  postalCodeRegex = /^\d{4}$/; // Exact 4 digits

  get isCheckoutFormValid(): boolean {
    const { fullName, email, phoneNumber, district, postalCode, fullAddress, subDistrict } = this.checkoutForm;

    // Basic existence check (Removed postalCode form strict requirements)
    const basicValidation = fullName && email && phoneNumber && district && fullAddress;

    // Sub-district check
    const subDistrictValidation = this.subDistricts.length > 0 ? !!subDistrict : true; // Optional if no sub-districts

    const isEmailValid = this.emailRegex.test(email);
    const isPhoneValid = this.phoneRegex.test(phoneNumber);
    // Postal code is optional, but if present must be valid
    const isPostalCodeValid = !postalCode || this.postalCodeRegex.test(postalCode);

    const isValid = !!(basicValidation && subDistrictValidation && isEmailValid && isPhoneValid && isPostalCodeValid);

    return isValid;
  }

  scrollToProducts() {
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToCategories() {
    if (!isPlatformBrowser(this.platformId)) return;
    const categoriesSection = document.getElementById('categories');
    if (categoriesSection) {
      categoriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToAboutUs() {
    this.router.navigate(['/about']);
  }

  openCheckout() {
    if (this.cartService.cart().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Cart is Empty', detail: 'Add items to cart first' });
      return;
    }
    // Reset payment method to default to ensure modal logic works
    this.selectedPaymentMethod = null;
    this.displayCheckoutModal = true;
  }

  placeOrder() {
    // This method now only validates the form and opens the payment modal.
    // Order creation is handled by submitBkashPayment() or confirmCOD().
    if (!this.isCheckoutFormValid) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill all required fields correctly.' });

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
    this.selectedPaymentMethod = null; // Reset payment method
    this.bkashPhone = this.checkoutForm.phoneNumber;
    // Reset placedOrderId to ensure a new order is created
    this.placedOrderId = '';
  }

  trackOrder() {
    if (!this.trackPhone) {
      this.showError('Please enter a phone number');
      return;
    }

    this.trackingLoading = true;
    this.hasSearched = true;
    this.orderService.trackOrdersByPhone(this.trackPhone).subscribe({
      next: (orders) => {
        // Sort by date descending
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

    const oid = parseInt(this.placedOrderId, 10);

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
            this.messageService.add({ severity: 'success', summary: 'Payment Submitted', detail: 'Waiting for admin verification.' });
            this.displayPaymentMethodModal = false;
            this.displayPaymentSuccessModal = true;
          },
          error: (err: any) => {
            console.error('Payment confirmation failed', err);

            // Extract error message from backend response if available
            let errorMsg = 'Failed to confirm payment. Please check Transaction ID.';
            if (err.error && err.error.detail) {
              if (typeof err.error.detail === 'string') {
                errorMsg = err.error.detail;
              } else if (Array.isArray(err.error.detail)) {
                // Handle Pydantic validation errors
                errorMsg = err.error.detail.map((e: any) => e.msg).join(', ');
              }
            }

            this.showError(errorMsg);
          }
        });
      } else {
        // COD - Just finish
        this.messageService.add({ severity: 'success', summary: 'COD Selected', detail: 'Waiting for admin verification.' });
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
    // Try lowercase payment method if backend expects it
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

  private prepareOrderData(paymentMethod: 'COD' | 'bKash'): any {
    return {
      ...this.checkoutForm,
      items: this.cartService.cart(), // Use CartService
      totalAmount: this.getTotalPrice(),
      status: 'Pending' as 'Pending',
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Confirmed' : 'Pending',
      deliveryLocation: this.deliveryLocation,
      deliveryCharge: this.currentDeliveryCharge,
      orderDate: new Date()
    };
  }

  async confirmCOD() {
    this.loading.set(true);
    const orderData = this.prepareOrderData('COD');

    try {
      const orderId = await lastValueFrom(this.orderService.createOrder(orderData));
      this.placedOrderId = orderId;

      // Since it's COD, we can directly show success
      this.messageService.add({ severity: 'success', summary: 'Order Confirmed', detail: 'Your COD order has been placed successfully.' });
      this.displayOrderSuccessModal = false;
      this.displayFinalSuccessModal = true;

      // Clear cart and reset
      const cartItemsToReduce = [...this.cartService.cart()];
      this.cartService.clearCart(); // Use CartService
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
        const orderId = await lastValueFrom(this.orderService.createOrder(orderData));
        this.placedOrderId = orderId;
      } catch (err) {
        console.error('bKash Order creation failed', err);
        this.showError('Failed to create order before payment. Please try again.');
        this.loading.set(false);
        return;
      }
    }

    const oid = parseInt(this.placedOrderId, 10);

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

      await lastValueFrom(this.orderService.submitTrx(oid, payload));

      // Success Logic
      this.messageService.add({ severity: 'success', summary: 'Payment Submitted', detail: 'Your payment has been submitted for verification.' });
      this.displayOrderSuccessModal = false;
      this.displayFinalSuccessModal = true;

      // Clear cart and reset
      const cartItemsToReduce = [...this.cartService.cart()];
      this.cartService.clearCart(); // Use CartService
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

  isOutOfStock(product: Product): boolean {
    return !product.isInStock;
  }


  selectCategory(category: Category | null) {
    if (category) {
      this.router.navigate(['/category', category.id]);
    } else {
      this.selectedCategory = null;
      this.loadProducts();
    }
  }
}
