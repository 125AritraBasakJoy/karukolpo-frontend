import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { forkJoin, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { CartItem, CartCombo } from '../../../models/cart.model';
import { Product } from '../../../models/product.model';
import { ComboView } from '../../../models/combo.model';
import { CartQuoteRequest, CartQuoteResponse } from '../../../models/quote.model';
import { MessageService } from 'primeng/api';
import { ProductService } from '../product/product.service';
import { ComboService } from '../combo/combo.service';
import { JourneyService } from '../tracking/journey.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly ABANDON_KEY = 'cart_abandon_at';
  private readonly ABANDON_MS = 600000;
  private readonly COMBOS_STORAGE_KEY = 'cart_combos';
  private abandonTimer: any = null;

  cart = signal<CartItem[]>([]);
  combos = signal<CartCombo[]>([]);

  quote = signal<CartQuoteResponse | null>(null);
  quoteLoading = signal<boolean>(false);
  quoteError = signal<string | null>(null);

  private quoteSubject = new Subject<{
    district?: string | null;
    phone?: string | null;
    couponCode?: string | null;
  }>();

  getItemPrice(product: Product): number {
    return product.effective_price !== undefined && product.effective_price !== null
      ? product.effective_price
      : product.price;
  }

  getItemSubtotal(item: CartItem): number {
    return this.getItemPrice(item.product) * item.quantity;
  }

  getComboKey(comboId: string, picks?: string[] | null): string {
    const sortedPicks = picks && picks.length ? [...picks].sort().join(',') : '';
    return `${comboId}::${sortedPicks}`;
  }

  totalItems = computed(() => {
    const standaloneCount = this.cart().reduce((total, item) => total + item.quantity, 0);
    const comboCount = this.combos().reduce((total, combo) => total + combo.quantity, 0);
    return standaloneCount + comboCount;
  });

  subTotal = computed(() => {
    const standaloneSub = this.cart().reduce((total, item) => total + this.getItemSubtotal(item), 0);
    const comboSub = this.combos().reduce((total, c) => {
      const price = typeof c.combo.combo_price === 'string'
        ? parseFloat(c.combo.combo_price)
        : Number(c.combo.combo_price || 0);
      return total + (price * c.quantity);
    }, 0);
    return standaloneSub + comboSub;
  });

  isEmpty = computed(() => this.cart().length === 0 && this.combos().length === 0);

  constructor(
    private messageService: MessageService,
    private productService: ProductService,
    private comboService: ComboService,
    private journeyService: JourneyService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          const normalizedItems = items.map((item: any) => {
            if (item.product) {
              if (typeof item.product.manualStockStatus === 'string') {
                item.product.manualStockStatus = item.product.manualStockStatus.toUpperCase();
              }
              if (item.product.isInStock === undefined) {
                const stock = parseInt(String(item.product.stock || 0), 10);
                const status = item.product.manualStockStatus;
                item.product.isInStock = status === 'IN_STOCK' ? true : (status === 'OUT_OF_STOCK' ? false : stock > 0);
              }
            }
            return item;
          });
          this.cart.set(normalizedItems);
        } catch (e) {
          console.error('Failed to load cart', e);
        }
      }

      const savedCombos = localStorage.getItem(this.COMBOS_STORAGE_KEY);
      if (savedCombos) {
        try {
          const combosData = JSON.parse(savedCombos);
          if (Array.isArray(combosData)) {
            const normalizedCombos: CartCombo[] = combosData.map((c: any) => ({
              combo: c.combo,
              quantity: Math.max(1, Math.min(20, parseInt(c.quantity, 10) || 1)),
              picks: Array.isArray(c.picks) ? c.picks : undefined
            }));
            this.combos.set(normalizedCombos);
          }
        } catch (e) {
          console.error('Failed to load cart combos', e);
        }
      }
    }

    this.initQuotePipeline();
    this.handleAbandonedCart();
  }

  private initQuotePipeline() {
    this.quoteSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      switchMap(params => {
        if (this.isEmpty()) {
          this.quote.set(null);
          this.quoteLoading.set(false);
          this.quoteError.set(null);
          return of(null);
        }

        const req = this.buildQuoteRequest(params.district, params.phone, params.couponCode);
        this.quoteLoading.set(true);
        this.quoteError.set(null);

        return this.comboService.quoteCart(req, true).pipe(
          tap({
            next: (res) => {
              this.quote.set(res);
              this.quoteLoading.set(false);
              this.quoteError.set(null);
            },
            error: (err) => {
              this.quoteLoading.set(false);
              const detail = err?.error?.detail || err?.message || 'Failed to price cart';
              this.quoteError.set(detail);
            }
          }),
          catchError(() => of(null))
        );
      })
    ).subscribe();
  }

  buildQuoteRequest(
    district?: string | null,
    phone?: string | null,
    couponCode?: string | null
  ): CartQuoteRequest {
    const items = this.cart().map(item => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));

    const combos = this.combos().map(c => ({
      combo_id: c.combo.id,
      quantity: c.quantity,
      ...(c.picks && c.picks.length ? { picks: c.picks } : {})
    }));

    return {
      items,
      combos,
      district: district || null,
      phone: phone || null,
      coupon_code: couponCode || null
    };
  }

  fetchQuote(district?: string | null, phone?: string | null, couponCode?: string | null) {
    this.quoteSubject.next({ district, phone, couponCode });
  }

  private saveCombos() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.COMBOS_STORAGE_KEY, JSON.stringify(this.combos()));
    }
  }

  addComboToCart(combo: ComboView, requestedQuantity: number = 1, picks?: string[]): number {
    const qty = Math.max(1, Math.min(20, Math.floor(requestedQuantity || 1)));
    const key = this.getComboKey(combo.id, picks);
    const currentCombos = this.combos();
    const existingIndex = currentCombos.findIndex(c => this.getComboKey(c.combo.id, c.picks) === key);

    let acceptedQty = qty;
    if (existingIndex >= 0) {
      const existing = currentCombos[existingIndex];
      const maxAddable = Math.max(0, 20 - existing.quantity);
      if (maxAddable === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Limit Reached',
          detail: 'Maximum 20 sets per combo offer in cart',
          life: 2500
        });
        return 0;
      }
      acceptedQty = Math.min(qty, maxAddable);
      this.combos.update(list => list.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + acceptedQty } : item
      ));
    } else {
      this.combos.update(list => [...list, { combo, quantity: acceptedQty, picks: picks ? [...picks] : undefined }]);
    }

    this.journeyService.track('add_to_cart', { quantity: acceptedQty });
    this.saveCombos();

    const detail = acceptedQty > 1
      ? `${acceptedQty} × ${combo.name} sets added to cart`
      : `${combo.name} combo added to cart`;

    this.messageService.add({
      severity: 'success',
      summary: 'Added to Cart',
      detail,
      life: 2500
    });

    this.fetchQuote();
    return acceptedQty;
  }

  updateComboQuantity(entry: CartCombo, change: number) {
    const key = this.getComboKey(entry.combo.id, entry.picks);
    const current = this.combos();
    const existing = current.find(c => this.getComboKey(c.combo.id, c.picks) === key);
    if (!existing) return;

    const newQuantity = existing.quantity + change;
    if (newQuantity <= 0) {
      this.removeCombo(entry);
      return;
    }

    if (newQuantity > 20) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Limit Reached',
        detail: 'Maximum 20 sets per combo offer',
        life: 2500
      });
      return;
    }

    this.combos.update(list => list.map(c =>
      this.getComboKey(c.combo.id, c.picks) === key ? { ...c, quantity: newQuantity } : c
    ));
    this.saveCombos();
    this.fetchQuote();
  }

  removeCombo(entry: CartCombo) {
    const key = this.getComboKey(entry.combo.id, entry.picks);
    this.journeyService.track('remove_from_cart', { quantity: entry.quantity });
    this.combos.update(list => list.filter(c => this.getComboKey(c.combo.id, c.picks) !== key));
    this.saveCombos();
    this.fetchQuote();
  }

  changeComboPicks(entry: CartCombo, newPicks: string[]): boolean {
    const oldKey = this.getComboKey(entry.combo.id, entry.picks);
    const newKey = this.getComboKey(entry.combo.id, newPicks);

    const currentList = this.combos();
    const existingTargetIndex = currentList.findIndex(c => this.getComboKey(c.combo.id, c.picks) === newKey);

    if (existingTargetIndex >= 0 && oldKey !== newKey) {
      const target = currentList[existingTargetIndex];
      const mergedQty = target.quantity + entry.quantity;
      if (mergedQty > 20) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Limit Reached',
          detail: 'Cannot merge sets: total would exceed the 20 sets limit',
          life: 2500
        });
        return false;
      }
      this.combos.update(list =>
        list
          .filter(c => this.getComboKey(c.combo.id, c.picks) !== oldKey)
          .map(c => this.getComboKey(c.combo.id, c.picks) === newKey ? { ...c, quantity: mergedQty } : c)
      );
    } else {
      this.combos.update(list => list.map(c =>
        this.getComboKey(c.combo.id, c.picks) === oldKey ? { ...c, picks: [...newPicks] } : c
      ));
    }

    this.saveCombos();
    this.fetchQuote();
    return true;
  }

  refreshCartProducts() {
    const current = this.cart();
    if (current.length === 0) return;

    const uniqueIds = Array.from(new Set(current.map(i => i.product.id).filter(Boolean)));
    const fetches = uniqueIds.map(id => this.productService.getProductById(id));

    forkJoin(fetches).subscribe({
      next: (freshProducts) => {
        let cartUpdated = false;
        const updatedItems = this.cart().map(item => {
          const fresh = freshProducts.find(p => p && p.id === item.product.id);
          if (fresh) {
            cartUpdated = true;
            return {
              ...item,
              product: {
                ...item.product,
                price: fresh.price,
                effective_price: fresh.effective_price,
                isInStock: fresh.isInStock,
                stock: fresh.stock ?? item.product.stock,
                manualStockStatus: fresh.manualStockStatus ?? item.product.manualStockStatus
              }
            };
          }
          return item;
        });

        if (cartUpdated) {
          this.cart.set(updatedItems);
          this.saveCart();
        }
      },
      error: (err) => console.error('Failed to refresh cart products', err)
    });
  }

  private saveCart() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cart', JSON.stringify(this.cart()));
    }
  }

  addToCart(product: Product, requestedQuantity: number = 1): number {
    const qty = Math.max(1, Math.floor(requestedQuantity || 1));

    // Check global stock first
    if (this.isOutOfStock(product)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Out of Stock',
        detail: 'This product is out of stock',
        life: 2500
      });
      return 0;
    }

    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const isForcedInStock = product.manualStockStatus === 'IN_STOCK';
    const availableStock = product.stock || 0;

    let acceptedQty = qty;
    if (!isForcedInStock && availableStock > 0) {
      const maxAddable = Math.max(0, availableStock - currentQty);
      if (maxAddable === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Stock Limit',
          detail: `Cannot add more than ${availableStock} items`,
          life: 2500
        });
        return 0;
      }
      if (qty > maxAddable) {
        acceptedQty = maxAddable;
      }
    }

    if (existingItem) {
      this.cart.update(items => items.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + acceptedQty } : item
      ));
    } else {
      this.cart.update(items => [...items, { product, quantity: acceptedQty }]);
    }

    this.journeyService.track('add_to_cart', { product_id: String(product.id), quantity: acceptedQty });
    this.saveCart();
    this.fetchQuote();

    if (acceptedQty < qty) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock Limit',
        detail: `Added ${acceptedQty} items (maximum available is ${availableStock})`,
        life: 2500
      });
    } else {
      const detail = acceptedQty > 1
        ? `${acceptedQty} × ${product.name} added to cart`
        : `${product.name} added to cart`;
      this.messageService.add({
        severity: 'success',
        summary: 'Added to Cart',
        detail,
        life: 2500
      });
    }

    return acceptedQty;
  }

  isOutOfStock(product: Product): boolean {
    return !product.isInStock;
  }

  updateQuantity(item: CartItem, change: number) {
    const currentCart = this.cart();
    const targetItem = currentCart.find(i => i.product.id === item.product.id);

    if (!targetItem) return;

    // If increasing, check if still in stock (manual status could have changed)
    if (change > 0 && this.isOutOfStock(targetItem.product)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Out of Stock',
        detail: 'This product is no longer available',
        life: 2500
      });
      return;
    }

    const newQuantity = targetItem.quantity + change;

    // Check max stock when increasing
    const isForcedInStock = targetItem.product.manualStockStatus === 'IN_STOCK';
    const availableStock = targetItem.product.stock || 0;
    if (change > 0 && !isForcedInStock && availableStock > 0 && newQuantity > availableStock) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock Limit',
        detail: `Only ${availableStock} items available`,
        life: 2500
      });
      return;
    }

    if (newQuantity <= 0) {
      this.journeyService.track('remove_from_cart', { product_id: String(item.product.id) });
      this.cart.update(items => items.filter(i => i.product.id !== item.product.id));
    } else {
      this.cart.update(items => items.map(i =>
        i.product.id === item.product.id ? { ...i, quantity: newQuantity } : i
      ));
    }
    this.saveCart();
    this.fetchQuote();
  }

  markCheckoutLeft() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.ABANDON_KEY, String(Date.now()));
    }
  }

  clearAbandonClock() {
    if (this.abandonTimer) {
      clearTimeout(this.abandonTimer);
      this.abandonTimer = null;
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.ABANDON_KEY);
    }
  }

  handleAbandonedCart() {
    if (!isPlatformBrowser(this.platformId)) return;

    const raw = localStorage.getItem(this.ABANDON_KEY);
    if (!raw) return;

    const startedAt = parseInt(raw, 10);
    if (isNaN(startedAt)) {
      localStorage.removeItem(this.ABANDON_KEY);
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= this.ABANDON_MS) {
      this.clearAbandonClock();
      if (this.cart().length > 0 || this.combos().length > 0) {
        this.clearCart();
      }
      return;
    }

    // Timer still running: clear the abandoned cart when it expires.
    if (this.abandonTimer) {
      clearTimeout(this.abandonTimer);
    }
    this.abandonTimer = setTimeout(() => {
      this.abandonTimer = null;
      if (isPlatformBrowser(this.platformId) && localStorage.getItem(this.ABANDON_KEY)) {
        this.clearAbandonClock();
        if (this.cart().length > 0 || this.combos().length > 0) {
          this.clearCart();
        }
      }
    }, this.ABANDON_MS - elapsed);
  }

  clearCart() {
    this.cart.set([]);
    this.combos.set([]);
    this.quote.set(null);
    this.saveCart();
    this.saveCombos();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('karukolpo_checkout_draft');
    }
  }
}
