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
    DropdownModule
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
    public themeService: ThemeService
  ) { }

  ngOnInit() {
    this.loadProducts();
    this.loadLandingPageConfig();
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

  getTotalPrice(): number {
    return this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0);
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

    return !!(basicValidation && subDistrictValidation && isEmailValid && isPhoneValid && isPostalCodeValid);
  }

  openCheckout() {
    if (this.cart().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Cart is Empty', detail: 'Add items to cart first' });
      return;
    }
    this.displayCheckoutModal = true;
  }

  placeOrder() {
    const order = {
      ...this.checkoutForm,
      items: this.cart(),
      totalAmount: this.getTotalPrice(),
      status: 'Pending' as const,
      orderDate: new Date()
    };

    this.orderService.createOrder(order).subscribe(orderId => {
      this.placedOrderId = orderId;
      this.displayCheckoutModal = false;
      this.displayOrderSuccessModal = true;
      this.cart.set([]);
      this.resetCheckoutForm();

      // Simulate push notification
      this.orderService.notifyAdmin(orderId);
    });
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
}
