import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Inject,
    OnDestroy,
    OnInit,
    PLATFORM_ID,
    signal,
    ViewChild
} from '@angular/core';
import { CommonModule, CurrencyPipe, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { forkJoin, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductService } from '../../core/services/product/product.service';
import { Product } from '../../models/product.model';
import { ContactService } from '../../core/services/contact/contact.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { DeliveryService } from '../../core/services/delivery/delivery.service';
import { SiteConfigService } from '../../core/services/site-config/site-config.service';
import { CategoryService } from '../../core/services/category/category.service';
import { Category } from '../../models/category.model';
import { CartService } from '../../core/services/cart/cart.service';
import { DividerModule } from 'primeng/divider';
import { HomeCheckoutModalsComponent } from './home-checkout-modals.component';

@Component({
    selector: 'app-home',
    imports: [
        CommonModule,
        ButtonModule,
        FormsModule,
        InputTextModule,
        TextareaModule,
        ToastModule,
        DividerModule,
        CurrencyPipe,
        NgOptimizedImage,
        RouterModule,
        HomeCheckoutModalsComponent
    ],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
    // cart = signal<CartItem[]>([]); // Removed, using CartService
    loading = signal<boolean>(false);
    checkoutRequested = signal<boolean>(false);
    displayProductModal = false;
    selectedProduct: Product | null = null;
    activeIndex: number = 0;
    @ViewChild('bestSellingList') bestSellingListEl!: ElementRef<HTMLElement>;
    @ViewChild('hotDealsList') hotDealsListEl!: ElementRef<HTMLElement>;
    // Contact Form
    contactForm = {
        name: '',
        contactInfo: '',
        message: ''
    };
    isContactSubmitting = false;
    landingPageTagline = signal<string>('Authentic Bangladeshi Handcrafts');
    categoryImages: { [key: string]: string } = {
        'Prodip': 'assets/categories/prodip.webp',
        'Protima': 'assets/categories/protima.webp',
        'Shora': 'assets/categories/shora.webp',
        'Home Decor': 'assets/categories/homedecor.webp',
        'Mirror': 'assets/categories/mirror.webp',
        'Sharee': 'assets/categories/sharee.webp'
    };
    categories = this.categoryService.categories;
    selectedCategory: Category | null = null;
    hotDeals = signal<Product[]>([]);
    bestSelling = signal<Product[]>([]);
    dropdownOpen = false;
    responsiveOptions: any[] = [
        {
            breakpoint: '1600px',
            numVisible: 6,
            numScroll: 1
        },
        {
            breakpoint: '1400px',
            numVisible: 5,
            numScroll: 1
        },
        {
            breakpoint: '1191px',
            numVisible: 4,
            numScroll: 1
        },
        {
            breakpoint: '991px',
            numVisible: 3,
            numScroll: 1
        },
        {
            breakpoint: '767px',
            numVisible: 2, // 2 items on standard mobile
            numScroll: 1
        },
        {
            breakpoint: '480px',
            numVisible: 2, // Keep 2 even on small phones but we'll scale down padding/font
            numScroll: 1
        }
    ];
    private storageListener: (() => void) | null = null;
    private autoScrollTimer: any = null;
    private resumeAutoScrollTimer: any = null;
    private readonly autoScrollInteractionHandler = (event: Event) => this.pauseAutoScroll(event);

    constructor(
        private productService: ProductService,
        private messageService: MessageService,
        private titleService: Title,
        private metaService: Meta,
        public contactService: ContactService,
        public themeService: ThemeService,
        public siteConfigService: SiteConfigService,
        private deliveryService: DeliveryService,
        private categoryService: CategoryService,
        public cartService: CartService,
        private route: ActivatedRoute,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
    }

    // Replaces confirmPayment and integration into placeOrder
    getCategoryImage(categoryName: string): string {
        if (!categoryName) return 'assets/logo.webp';

        const name = categoryName.toLowerCase().trim();
        const mapping: { [key: string]: string } = {
            'prodip': 'assets/categories/prodip.webp',
            'protima': 'assets/categories/protima.webp',
            'shora': 'assets/categories/shora.webp',
            'home decor': 'assets/categories/homedecor.webp',
            'homedecor': 'assets/categories/homedecor.webp',
            'mirror': 'assets/categories/mirror.webp',
            'sharee': 'assets/categories/sharee.webp'
        };

        return mapping[name] || 'assets/logo.webp';
    }

    openPaymentModal(orderId: string) {
        // Deprecated
    }

    submitContactForm() {
        if (!this.contactForm.name || !this.contactForm.contactInfo || !this.contactForm.message) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out all fields.' });
            return;
        }

        this.isContactSubmitting = true;
        const formData = {
            name: this.contactForm.name,
            contact: this.contactForm.contactInfo,
            message: this.contactForm.message
        };

        this.contactService.submitContactForm(formData).subscribe({
            next: (res) => {
                this.isContactSubmitting = false;
                this.messageService.add({ severity: 'success', summary: 'Message Sent', detail: 'Thank you for reaching out! We will get back to you soon.', life: 3000 });
                this.contactForm = {
                    name: '',
                    contactInfo: '',
                    message: ''
                };
            },
            error: (err) => {
                this.isContactSubmitting = false;
                console.error('Error sending message', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send message. Please try again later.' });
            }
        });
    }

    ngOnInit() {
        this.loadSpecialSections();
        this.loadLandingPageConfig();

        // Check for checkout query param
        this.route.queryParams.subscribe(params => {
            if (params['checkout'] === 'true') {
                // Wait a bit for products/cart to load if needed, but cart is local storage so it's fast
                setTimeout(() => {
                    this.checkoutRequested.set(true);
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

        this.startAutoScroll();
        if (isPlatformBrowser(this.platformId)) {
            document.addEventListener('touchstart', this.autoScrollInteractionHandler, { passive: true });
        }
    }

    updateSeo() {
        const title = 'Karukolpo | Authentic Bangladeshi Handcrafts';
        const description = 'Discover Karukolpo: Premium Bangladeshi handcrafted heritage products, home decor, and authentic artisan creations. Support local craftsmen.';
        // Resolve the image against the domain actually serving the app, so the
        // social-share image never points at a stale/wrong host.
        const imageUrl = isPlatformBrowser(this.platformId)
            ? `${window.location.origin}/assets/landing-bg.webp`
            : 'https://karukolpo.com/assets/landing-bg.webp';
        const siteUrl = 'https://karukolpo.com/';

        this.titleService.setTitle(title);

        // Standard Meta Tags
        this.metaService.updateTag({ name: 'description', content: description });

        // Open Graph / Facebook
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:image', content: imageUrl });
        this.metaService.updateTag({ property: 'og:url', content: siteUrl });
        this.metaService.updateTag({ property: 'og:type', content: 'website' });

        // Twitter
        this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
        this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });
    }

    loadProducts() {
        this.loadSpecialSections();
    }

    private loadSpecialSections() {
        const config = this.siteConfigService.siteConfig();

        if (!config.hasHotDeals && !config.hasBestSellers) {
            this.loading.set(false);
            return;
        }

        this.loading.set(true);

        const requests: any = {};
        if (config.hasHotDeals) {
            requests.hotDeals = this.productService.getHotDeals();
        } else {
            requests.hotDeals = of([]);
        }

        if (config.hasBestSellers) {
            requests.bestSellers = this.productService.getBestSellers();
        } else {
            requests.bestSellers = of([]);
        }

        forkJoin(requests).subscribe({
            next: (result: any) => {
                const hotDeals = result.hotDeals || [];
                const bestSelling = result.bestSellers || [];
                this.bestSelling.set(bestSelling);
                this.hotDeals.set(this.dedupeAgainst(hotDeals, bestSelling));
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching special sections', err);
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
        this.stopAutoScroll();
        if (isPlatformBrowser(this.platformId)) {
            document.removeEventListener('touchstart', this.autoScrollInteractionHandler);
        }
    }

    scrollLeft(element: HTMLElement) {
        element.scrollBy({ left: -300, behavior: 'smooth' });
    }

    scrollRight(element: HTMLElement) {
        element.scrollBy({ left: 300, behavior: 'smooth' });
    }

    private startAutoScroll() {
        if (!isPlatformBrowser(this.platformId) || this.autoScrollTimer) {
            return;
        }
        this.autoScrollTimer = setInterval(() => {
            this.autoScrollStep();
        }, 3000);
    }

    private stopAutoScroll() {
        if (this.autoScrollTimer) {
            clearInterval(this.autoScrollTimer);
            this.autoScrollTimer = null;
        }
        if (this.resumeAutoScrollTimer) {
            clearTimeout(this.resumeAutoScrollTimer);
            this.resumeAutoScrollTimer = null;
        }
    }

    private pauseAutoScroll(event: Event) {
        const target = event.target as HTMLElement | null;
        if (!target || !target.closest('.product-swipe-container')) {
            return;
        }
        this.stopAutoScroll();
        this.resumeAutoScrollTimer = setTimeout(() => this.startAutoScroll(), 6000);
    }

    private dedupeAgainst(products: Product[], keep: Product[]): Product[] {
        const keepIds = new Set(keep.map(p => p.id));
        return products.filter(p => !keepIds.has(p.id));
    }

    private autoScrollStep() {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        const containers = [this.bestSellingListEl, this.hotDealsListEl]
            .filter((ref): ref is ElementRef<HTMLElement> => !!ref && !!ref.nativeElement)
            .map(ref => ref.nativeElement);

        for (const el of containers) {
            const maxScroll = el.scrollWidth - el.clientWidth;
            if (maxScroll <= 0) {
                continue;
            }
            const step = Math.max(el.clientWidth * 0.6, 180);
            if (el.scrollLeft + step >= maxScroll - 1) {
                el.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                el.scrollBy({ left: step, behavior: 'smooth' });
            }
        }
    }

    showProductDetails(product: Product) {
        // Navigate to product details page instead of modal
        this.router.navigate(['/products', product.id]);
    }

    addToCart(product: Product) {
        this.cartService.addToCart(product);
    }

    getTotalCartItems(): number {
        return this.cartService.totalItems();
    }

    scrollToHotDeals() {
        if (!isPlatformBrowser(this.platformId)) return;
        const hotDealsSection = document.getElementById('hot-deals');
        if (hotDealsSection) {
            hotDealsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    viewAllProducts() {
        this.router.navigate(['/all-products']);
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
