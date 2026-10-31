import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CartService } from './cart.service';
import { ProductService } from '../product/product.service';
import { ComboService } from '../combo/combo.service';
import { JourneyService } from '../tracking/journey.service';
import { ComboView } from '../../../models/combo.model';

describe('CartService Combo Support', () => {
  let service: CartService;
  let comboServiceMock: any;
  let messageServiceMock: any;
  let journeyServiceMock: any;

  const sampleCombo: ComboView = {
    id: 'c1',
    name: 'Sample Bundle',
    kind: 'mix_and_match',
    slot_count: 2,
    pricing_type: 'fixed_price',
    pricing_value: 500,
    items: [],
    list_total: 600,
    combo_price: 500,
    savings: 100
  };

  beforeEach(() => {
    localStorage.clear();
    comboServiceMock = {
      quoteCart: jasmine.createSpy('quoteCart').and.returnValue(of({
        lines: [],
        combos: [],
        subtotal: 500,
        product_discount: 0,
        combo_discount: 100,
        delivery_charge: 70,
        delivery_discount: 0,
        total: 570,
        problems: []
      }))
    };
    messageServiceMock = { add: jasmine.createSpy('add') };
    journeyServiceMock = { track: jasmine.createSpy('track') };

    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: ComboService, useValue: comboServiceMock },
        { provide: ProductService, useValue: {} },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: JourneyService, useValue: journeyServiceMock },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    service = TestBed.inject(CartService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('computes identical canonical keys for pick permutations and distinct keys for multiplicities', () => {
    const key1 = service.getComboKey('c1', ['p1', 'p2']);
    const key2 = service.getComboKey('c1', ['p2', 'p1']);
    expect(key1).toBe(key2);

    const key3 = service.getComboKey('c1', ['p1', 'p1', 'p2']);
    const key4 = service.getComboKey('c1', ['p1', 'p2', 'p2']);
    expect(key3).not.toBe(key4);
  });

  it('adds combo to cart, respects 20 sets cap and calculates totalItems', () => {
    service.addComboToCart(sampleCombo, 2, ['p1', 'p2']);
    expect(service.combos().length).toBe(1);
    expect(service.combos()[0].quantity).toBe(2);
    expect(service.totalItems()).toBe(2);
    expect(service.isEmpty()).toBeFalse();

    // Adding 19 more should clamp to 20
    service.addComboToCart(sampleCombo, 19, ['p1', 'p2']);
    expect(service.combos()[0].quantity).toBe(20);
    expect(service.totalItems()).toBe(20);

    // Adding further when at 20 shows warning and adds 0
    const added = service.addComboToCart(sampleCombo, 1, ['p1', 'p2']);
    expect(added).toBe(0);
    expect(service.combos()[0].quantity).toBe(20);
  });

  it('updates combo quantity and removes entry when quantity reaches 0', () => {
    service.addComboToCart(sampleCombo, 2, ['p1', 'p2']);
    const entry = service.combos()[0];

    service.updateComboQuantity(entry, 1);
    expect(service.combos()[0].quantity).toBe(3);

    service.updateComboQuantity(entry, -3);
    expect(service.combos().length).toBe(0);
    expect(service.isEmpty()).toBeTrue();
  });

  it('merges quantities when changing picks to match an existing configuration', () => {
    service.addComboToCart(sampleCombo, 2, ['p1', 'p2']);
    service.addComboToCart(sampleCombo, 3, ['p3', 'p4']);
    expect(service.combos().length).toBe(2);

    const secondEntry = service.combos()[1];
    // Changing second entry to ['p2', 'p1'] should merge into first entry (quantity 2 + 3 = 5)
    const success = service.changeComboPicks(secondEntry, ['p2', 'p1']);
    expect(success).toBeTrue();
    expect(service.combos().length).toBe(1);
    expect(service.combos()[0].quantity).toBe(5);
  });

  it('clears both standalone items and combos on clearCart', () => {
    service.addComboToCart(sampleCombo, 1, ['p1', 'p2']);
    expect(service.combos().length).toBe(1);

    service.clearCart();
    expect(service.combos().length).toBe(0);
    expect(service.cart().length).toBe(0);
    expect(service.isEmpty()).toBeTrue();
  });
});
