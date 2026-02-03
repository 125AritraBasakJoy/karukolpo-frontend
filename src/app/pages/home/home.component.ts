import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DataViewModule } from 'primeng/dataview';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
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
import { TagModule } from 'primeng/tag'; // Added TagModule
import JsBarcode from 'jsbarcode';
import { forkJoin, map, catchError, of } from 'rxjs';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { Order } from '../../models/order.model';

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
        InputTextarea,
        ToastModule,
        GalleriaModule,
        ProgressSpinnerModule,
        DropdownModule,
        RadioButtonModule,
        SkeletonModule,
        BadgeModule,
        TagModule, // Added TagModule
        ThemeToggleComponent
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
  displayPaymentMethodModal = false; 
  displayPaymentSuccessModal = false;
  displayTrackOrderModal = false;

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

  // Track Order
  trackPhone = '';
  trackedOrders: Order[] = [];
  trackingLoading = false;
  hasSearched = false;

  // Delivery Logic
  deliveryLocation: 'Inside Dhaka' | 'Outside Dhaka' = 'Inside Dhaka';
  currentDeliveryCharge = 0;
  deliveryCharges = { insideDhaka: 60, outsideDhaka: 120 };

  districts: District[] = districts;
  subDistricts: string[] = [];

  placedOrderId = '';
  currentPaymentId: number | null = null; 
  transactionId = ''; 

  landingPageImage = signal<string>('assets/landing-bg.jpg'); 
  landingPageTagline = signal<string>('Authentic Bangladeshi Handcrafts');

  categories = signal<Category[]>([]);
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
    public contactService: ContactService,
    public themeService: ThemeService,
    public siteConfigService: SiteConfigService,
    private paymentService: PaymentService,
    private deliveryService: DeliveryService,
    private categoryService: CategoryService
  ) { }

  openPaymentModal(orderId: string) {
    // Deprecated: Payment flow integrated into checkout
  }

  displayPaymentModal = false; 
  selectedPaymentMethod: 'COD' | 'bKash' | null = null;
  bkashQrCodeInModal: string | null = null;

  // New combined state
  isPaymentSelected = false;

  selectPaymentMethod(method: 'COD' | 'bKash') {
    // Reset payment ID if method changes to ensure new payment creation
    if (this.selectedPaymentMethod !== method) {
        this.currentPaymentId = null;
    }
    
    this.selectedPaymentMethod = method;
    this.isPaymentSelected = true;
    if (method === 'bKash') {
      this.bkashQrCodeInModal = this.paymentService.getQrCode();
    }
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
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(cats => this.categories.set(cats));
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
        if (products.length === 0) {
          this.products.set([]);
          this.filteredProducts.set([]);
          this.loading.set(false);
          return;
        }

        const inventoryRequests = products.map(p => {
          const pid = parseInt(p.id, 10);
          
          // Fetch Inventory
          const inventoryReq = this.productService.getInventory(pid).pipe(
            catchError(() => of({ quantity: 0 }))
          );

          // Fetch Full Details
          const detailsReq = this.productService.getProductById(pid).pipe(
            catchError(() => of(p))
          );

          // Fetch Categories explicitly
          const categoriesReq = this.productService.listProductCategories(pid).pipe(
            catchError(() => of([]))
          );

          return forkJoin([inventoryReq, detailsReq, categoriesReq]).pipe(
            map(([inv, details, cats]) => {
                // Merge details, inventory, and category info
                // Prioritize the explicitly fetched category list
                const categoryId = (cats && cats.length > 0) ? cats[0].id.toString() : (details?.categoryId || p.categoryId);
                return { ...details, stock: inv.quantity, categoryId };
            })
          );
        });

        forkJoin(inventoryRequests).subscribe({
          next: (productsWithInventory: any[]) => {
             console.log('Loaded products with details:', productsWithInventory);
             // Log category IDs for debugging
             productsWithInventory.forEach(p => {
                 console.log(`Product: ${p.name}, CategoryID: ${p.categoryId}`);
             });
             
             this.products.set(productsWithInventory);
             this.filterProducts();
             this.loading.set(false);
          },
          error: (err) => {
            console.error('Error fetching inventory details', err);
            // Fallback to products without inventory details
            this.products.set(products);
            this.filterProducts();
            this.loading.set(false);
          }
        });
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
    // Check global stock first
    if ((product.stock || 0) <= 0) {
      this.messageService.add({ severity: 'error', summary: 'Out of Stock', detail: 'This product is out of stock' });
      return;
    }

    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity + 1 > (product.stock || 0)) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${product.stock} items` });
        return;
      }
      existingItem.quantity++;
    } else {
      if (1 > (product.stock || 0)) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${product.stock} items` });
        return;
      }
      this.cart.update(items => [...items, { product, quantity: 1 }]);
    }
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `${product.name} added to cart` });
    this.displayProductModal = false;
  }

  updateQuantity(item: CartItem, change: number) {
    const newQuantity = item.quantity + change;

    // Check max stock when increasing
    if (change > 0 && newQuantity > (item.product.stock || 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Only ${item.product.stock} items available` });
      return;
    }

    item.quantity = newQuantity;
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

  getTotalCartItems(): number {
    return this.cart().reduce((total, item) => total + item.quantity, 0);
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

  scrollToProducts() {
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openCheckout() {
    if (this.cart().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Cart is Empty', detail: 'Add items to cart first' });
      return;
    }
    this.displayCheckoutModal = true;
  }

  placeOrder() {
    // Step 1: Create Order
    // Payment method is not selected yet, so we send defaults or null if allowed.
    // OrderService maps paymentMethod to 'COD' by default if missing, which is fine for initial creation.
    
    const order = {
      ...this.checkoutForm,
      items: this.cart(),
      totalAmount: this.getTotalPrice(),
      status: 'Pending' as 'Pending',
      paymentMethod: null, // Default to null, will be updated by payment creation
      paymentStatus: 'Pending' as 'Pending',
      deliveryLocation: this.deliveryLocation,
      deliveryCharge: this.currentDeliveryCharge,
      orderDate: new Date()
    };

    try {
      this.orderService.createOrder(order as any).subscribe({
        next: (orderId) => {
          console.log('Order created successfully:', orderId);
          this.placedOrderId = orderId;
          
          // Close checkout modal and open success modal (Waiting for Approval)
          this.displayCheckoutModal = false;
          this.displayOrderSuccessModal = true;
          
          // Generate barcode after modal is visible
          setTimeout(() => {
            try {
              const element = document.getElementById("barcode");
              if (element) {
                JsBarcode(element, this.placedOrderId, {
                  format: "CODE128",
                  lineColor: "#000",
                  width: 2,
                  height: 40,
                  displayValue: true
                });
              }
            } catch (e) {
              console.error("Error generating barcode:", e);
            }
          }, 300);

          // Clear cart
          const cartItemsToReduce = [...this.cart()];
          this.cart.set([]);
          this.resetCheckoutForm();
          this.productService.reduceStock(cartItemsToReduce);
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
                error: (err) => {
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
        console.log('Using existing payment ID:', this.currentPaymentId);
        handleConfirmation(this.currentPaymentId);
        return;
    }
    
    // 1. Create Payment
    // Try lowercase payment method if backend expects it
    const methodToSend = this.selectedPaymentMethod === 'bKash' ? 'bkash' : 'cod';
    
    this.paymentService.createPayment(oid, methodToSend).subscribe({
        next: (payment) => {
            console.log('Payment created:', payment);
            
            if (payment && payment.id) {
                this.currentPaymentId = payment.id;
                handleConfirmation(payment.id);
            } else {
                console.error('Payment created but no ID returned', payment);
                this.showError('Payment initialization failed. Please try again.');
            }
        },
        error: (err) => {
            console.error('Payment creation failed', err);
            console.log('Error details:', JSON.stringify(err.error));
            this.showError('Failed to initiate payment. Please try again.');
        }
    });
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

  filterProducts() {
    console.log('Filtering products. Selected Category:', this.selectedCategory);
    if (this.selectedCategory) {
      const selectedId = this.selectedCategory.id.toString();
      const filtered = this.products().filter(p => {
        const prodCatId = p.categoryId ? p.categoryId.toString() : null;
        console.log(`Product ${p.name} (ID: ${p.id}) Category ID: ${prodCatId} vs Selected: ${selectedId}`);
        return prodCatId === selectedId;
      });
      console.log('Filtered count:', filtered.length);
      this.filteredProducts.set(filtered);
    } else {
      this.filteredProducts.set(this.products());
    }
  }

  selectCategory(category: Category | null) {
    this.selectedCategory = category;
    this.filterProducts();
    this.scrollToProducts();
  }
}
