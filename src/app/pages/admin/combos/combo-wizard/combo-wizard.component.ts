import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Subject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { ComboService } from '../../../../core/services/combo/combo.service';
import { ProductService } from '../../../../core/services/product/product.service';
import { CategoryService } from '../../../../core/services/category/category.service';
import { Product } from '../../../../models/product.model';
import { Category } from '../../../../models/category.model';
import {
  ComboKind,
  ComboPricingType,
  AdminComboPayload,
  AdminComboItemPayload
} from '../../../../models/combo.model';

interface ProductRow {
  product: Product | null;
  quantity: number;
}

@Component({
  selector: 'app-combo-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectButtonModule,
    DropdownModule,
    InputNumberModule,
    CalendarModule,
    InputSwitchModule,
    TagModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './combo-wizard.component.html',
  styleUrls: ['./combo-wizard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComboWizardComponent implements OnInit {
  activeStep = signal<number>(1);
  loading = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  comboId = signal<string | null>(null);

  // Form Fields
  name = '';
  description = '';
  kind: ComboKind = 'fixed';
  slotCount = 4;

  // Fixed set product rows
  productRows: ProductRow[] = [
    { product: null, quantity: 1 },
    { product: null, quantity: 1 }
  ];

  // Pick-any pool
  poolProducts: Product[] = [];
  selectedCategoryForPool: Category | null = null;
  categoryImportLoading = false;

  // Catalog search state for picker
  catalogSearchResults = signal<Product[]>([]);
  searchLoading = signal<boolean>(false);
  private searchSubject = new Subject<string>();

  // Pricing & Schedule
  pricingType: ComboPricingType = 'fixed_price';
  pricingValue: number = 0;
  isActive = true;
  startsAt: Date | null = null;
  endsAt: Date | null = null;

  serverError = signal<string | null>(null);

  kindOptions = [
    { label: 'Fixed Set / Multipack', value: 'fixed' },
    { label: 'Pick Any N (Mix & Match)', value: 'mix_and_match' }
  ];

  pricingOptions = [
    { label: 'Fixed Price', value: 'fixed_price' },
    { label: '% Off', value: 'percentage' },
    { label: 'Cheapest N Free', value: 'cheapest_free' }
  ];

  categories = computed(() => this.categoryService.categories());

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private comboService: ComboService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private messageService: MessageService
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.searchLoading.set(true);
        return this.productService.getProductsWithCount({ q: query, view: 'card', limit: 20 }).pipe(
          catchError(() => of({ items: [], total: 0 }))
        );
      })
    ).subscribe(res => {
      this.catalogSearchResults.set(res.items || []);
      this.searchLoading.set(false);
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.comboId.set(id);
      this.loadExistingCombo(id);
    } else {
      const prefill = this.route.snapshot.queryParamMap.get('prefill');
      if (prefill) {
        this.prefillFromSuggestion(prefill);
      }
      this.loadInitialCatalog();
    }
  }

  loadInitialCatalog() {
    this.searchSubject.next('');
  }

  onProductSearch(event: any) {
    const q = event.filter || '';
    this.searchSubject.next(q);
  }

  loadExistingCombo(id: string) {
    this.loading.set(true);
    this.comboService.getAdminComboById(id).subscribe({
      next: (combo) => {
        this.name = combo.name || '';
        this.description = combo.description || '';
        this.kind = combo.kind;
        this.slotCount = combo.slot_count || 4;
        this.pricingType = combo.pricing_type;
        this.pricingValue = typeof combo.pricing_value === 'string' ? parseFloat(combo.pricing_value) : Number(combo.pricing_value);
        this.isActive = combo.is_active !== false;
        this.startsAt = combo.starts_at ? new Date(combo.starts_at) : null;
        this.endsAt = combo.ends_at ? new Date(combo.ends_at) : null;

        if (combo.kind === 'mix_and_match') {
          this.poolProducts = combo.items.map(it => it.product);
        } else {
          this.productRows = combo.items.map(it => ({
            product: it.product,
            quantity: it.quantity || 1
          }));
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.detail || 'Failed to load combo'
        });
      }
    });
  }

  prefillFromSuggestion(productIdsStr: string) {
    const ids = productIdsStr.split(',').filter(Boolean);
    if (!ids.length) return;
    this.loading.set(true);
    const fetches = ids.map(id => this.productService.getProductById(id).pipe(catchError(() => of(null))));
    forkJoin(fetches).subscribe(products => {
      const valid = products.filter((p): p is Product => p !== null);
      if (valid.length) {
        this.productRows = valid.map(p => ({ product: p, quantity: 1 }));
      }
      this.loading.set(false);
    });
  }

  // Row management for Fixed mode
  addProductRow() {
    if (this.productRows.length >= 5) {
      this.messageService.add({ severity: 'warn', summary: 'Limit Reached', detail: 'Maximum 5 products allowed for fixed combo' });
      return;
    }
    this.productRows.push({ product: null, quantity: 1 });
  }

  removeProductRow(index: number) {
    if (this.productRows.length <= 1) {
      this.messageService.add({ severity: 'warn', summary: 'Minimum', detail: 'At least 1 product row is required' });
      return;
    }
    this.productRows.splice(index, 1);
  }

  // Pool management for Mix & Match mode
  addPoolProduct(product: Product) {
    if (this.poolProducts.some(p => p.id === product.id)) {
      this.messageService.add({ severity: 'warn', summary: 'Already in Pool', detail: `${product.name} is already added` });
      return;
    }
    if (this.poolProducts.length >= 50) {
      this.messageService.add({ severity: 'warn', summary: 'Limit Reached', detail: 'Maximum 50 pool products allowed' });
      return;
    }
    this.poolProducts.push(product);
  }

  removePoolProduct(index: number) {
    this.poolProducts.splice(index, 1);
  }

  importCategoryProducts() {
    if (!this.selectedCategoryForPool) return;
    this.categoryImportLoading = true;
    this.productService.getProductsWithCount({
      categoryId: String(this.selectedCategoryForPool.id),
      view: 'card',
      limit: 50
    }).subscribe({
      next: (res) => {
        this.categoryImportLoading = false;
        let added = 0;
        for (const p of (res.items || [])) {
          if (!this.poolProducts.some(existing => existing.id === p.id) && this.poolProducts.length < 50) {
            this.poolProducts.push(p);
            added++;
          }
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Imported',
          detail: `Added ${added} products from ${this.selectedCategoryForPool?.name}`
        });
      },
      error: () => {
        this.categoryImportLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to import products from category' });
      }
    });
  }

  // Computed Pricing Preview
  get previewListTotal(): number {
    if (this.kind === 'fixed') {
      return this.productRows.reduce((sum, row) => {
        if (!row.product) return sum;
        const price = row.product.effective_price ?? row.product.price ?? 0;
        return sum + (price * row.quantity);
      }, 0);
    } else {
      if (!this.poolProducts.length) return 0;
      const sortedPrices = this.poolProducts
        .map(p => p.effective_price ?? p.price ?? 0)
        .sort((a, b) => a - b);
      const cheapest = sortedPrices[0] || 0;
      return cheapest * this.slotCount;
    }
  }

  get previewComboPrice(): number {
    const total = this.previewListTotal;
    if (this.pricingType === 'fixed_price') {
      return this.pricingValue;
    }
    if (this.pricingType === 'percentage') {
      return Math.round((total * (1 - (this.pricingValue / 100))) * 100) / 100;
    }
    if (this.pricingType === 'cheapest_free') {
      const freeCount = Math.floor(this.pricingValue || 1);
      if (this.kind === 'fixed') {
        const unitPrices: number[] = [];
        for (const r of this.productRows) {
          if (!r.product) continue;
          const price = r.product.effective_price ?? r.product.price ?? 0;
          for (let q = 0; q < r.quantity; q++) unitPrices.push(price);
        }
        unitPrices.sort((a, b) => a - b);
        const freeSum = unitPrices.slice(0, freeCount).reduce((a, b) => a + b, 0);
        return Math.max(0, total - freeSum);
      } else {
        const sortedPrices = this.poolProducts
          .map(p => p.effective_price ?? p.price ?? 0)
          .sort((a, b) => a - b);
        const cheapest = sortedPrices[0] || 0;
        return Math.max(0, total - (cheapest * freeCount));
      }
    }
    return total;
  }

  get previewSavings(): number {
    return Math.max(0, Math.round((this.previewListTotal - this.previewComboPrice) * 100) / 100);
  }

  get previewSavingsPercent(): number {
    if (!this.previewListTotal) return 0;
    return Math.round((this.previewSavings / this.previewListTotal) * 100);
  }

  get isAValidSaving(): boolean {
    return this.previewSavings > 0;
  }

  get totalUnitsInSet(): number {
    if (this.kind === 'fixed') {
      return this.productRows.reduce((sum, r) => sum + r.quantity, 0);
    }
    return this.slotCount;
  }

  // Stepper Navigation & Step Validation
  goToStep(step: number) {
    if (step > this.activeStep()) {
      if (!this.validateStep(this.activeStep())) return;
    }
    this.activeStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onStepClick(step: number) {
    if (step <= this.activeStep()) {
      this.activeStep.set(step);
    } else {
      // Must pass all preceding steps
      for (let s = this.activeStep(); s < step; s++) {
        if (!this.validateStep(s)) return;
      }
      this.activeStep.set(step);
    }
  }

  validateStep(step: number): boolean {
    this.serverError.set(null);
    if (step === 1) {
      if (!this.name.trim()) {
        this.messageService.add({ severity: 'error', summary: 'Required', detail: 'Combo name is required' });
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (this.kind === 'fixed') {
        const validRows = this.productRows.filter(r => r.product !== null);
        if (validRows.length === 0) {
          this.messageService.add({ severity: 'error', summary: 'Products Required', detail: 'Select at least one product' });
          return false;
        }
        const prodIds = new Set(validRows.map(r => r.product!.id));
        if (prodIds.size !== validRows.length) {
          this.messageService.add({ severity: 'error', summary: 'Duplicate Product', detail: 'Each product can only appear once' });
          return false;
        }
        const totalUnits = validRows.reduce((sum, r) => sum + r.quantity, 0);
        if (totalUnits < 2) {
          this.messageService.add({ severity: 'error', summary: 'Minimum Units', detail: 'A combo needs at least 2 units in total (multipack or multi-product)' });
          return false;
        }
      } else {
        if (!this.slotCount || this.slotCount < 2 || this.slotCount > 20) {
          this.messageService.add({ severity: 'error', summary: 'Invalid Slots', detail: 'Slots must be between 2 and 20' });
          return false;
        }
        if (this.poolProducts.length < 2) {
          this.messageService.add({ severity: 'error', summary: 'Pool Too Small', detail: 'Pool must have at least 2 distinct products' });
          return false;
        }
      }
      return true;
    }

    if (step === 3) {
      if (!this.pricingValue || this.pricingValue <= 0) {
        this.messageService.add({ severity: 'error', summary: 'Invalid Price', detail: 'Enter a valid positive pricing value' });
        return false;
      }
      if (this.pricingType === 'percentage' && (this.pricingValue < 1 || this.pricingValue > 90)) {
        this.messageService.add({ severity: 'error', summary: 'Invalid Percentage', detail: 'Percentage must be between 1 and 90' });
        return false;
      }
      if (this.pricingType === 'cheapest_free') {
        if (!Number.isInteger(this.pricingValue) || this.pricingValue < 1 || this.pricingValue >= this.totalUnitsInSet) {
          this.messageService.add({
            severity: 'error',
            summary: 'Invalid Free Units',
            detail: `Free units must be a whole number between 1 and ${this.totalUnitsInSet - 1}`
          });
          return false;
        }
      }
      if (!this.isAValidSaving) {
        this.messageService.add({
          severity: 'error',
          summary: 'Not a Saving',
          detail: `Combo price (৳${this.previewComboPrice}) must cost less than buying separately (৳${this.previewListTotal})`
        });
        return false;
      }
      if (this.startsAt && this.endsAt && this.endsAt < this.startsAt) {
        this.messageService.add({ severity: 'error', summary: 'Invalid Dates', detail: 'End date cannot be before start date' });
        return false;
      }
      return true;
    }

    return true;
  }

  saveCombo() {
    for (let s = 1; s <= 3; s++) {
      if (!this.validateStep(s)) {
        this.activeStep.set(s);
        return;
      }
    }

    const items: AdminComboItemPayload[] = this.kind === 'fixed'
      ? this.productRows.filter(r => r.product !== null).map(r => ({
          product_id: r.product!.id,
          quantity: r.quantity
        }))
      : this.poolProducts.map(p => ({
          product_id: p.id,
          quantity: 1
        }));

    const payload: AdminComboPayload = {
      name: this.name.trim(),
      description: this.description.trim() || null,
      kind: this.kind,
      slot_count: this.kind === 'mix_and_match' ? this.slotCount : null,
      pricing_type: this.pricingType,
      pricing_value: this.pricingValue,
      is_active: this.isActive,
      starts_at: this.startsAt ? this.startsAt.toISOString() : null,
      ends_at: this.endsAt ? this.endsAt.toISOString() : null,
      items
    };

    this.loading.set(true);
    this.serverError.set(null);

    const call$ = this.isEditMode() && this.comboId()
      ? this.comboService.updateAdminCombo(this.comboId()!, payload)
      : this.comboService.createAdminCombo(payload);

    call$.subscribe({
      next: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Combo offer ${this.isEditMode() ? 'updated' : 'created'} successfully`
        });
        setTimeout(() => this.router.navigate(['/admin/dashboard/combos']), 600);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail || err?.message || 'Failed to save combo offer';
        this.serverError.set(detail);
        this.messageService.add({ severity: 'error', summary: 'Save Error', detail });
      }
    });
  }

  cancel() {
    this.router.navigate(['/admin/dashboard/combos']);
  }
}
