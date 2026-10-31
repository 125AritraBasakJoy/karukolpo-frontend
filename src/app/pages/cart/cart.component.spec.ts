import { CartComponent } from './cart.component';

describe('CartComponent cash memo names', () => {
    let component: any;
    let cartItems: any[];
    let cartCombos: any[];

    beforeEach(() => {
        cartItems = [{ product: { id: 'shared', name: 'Cart product', price: 999 }, quantity: 9 }];
        cartCombos = [{
            combo: {
                id: 'catalog-combo',
                items: [
                    { product: { id: 'shared', name: 'Cart product', price: 999 }, quantity: 8 },
                    { product: { id: 'combo-only', name: 'Bundle product', price: 888 }, quantity: 7 }
                ]
            },
            quantity: 6
        }];
        component = Object.create(CartComponent.prototype);
        component.cartService = { cart: () => cartItems, combos: () => cartCombos };
        component.checkoutForm = { fullName: 'Customer' };
        component.createdOrderObj = {
            items: [
                { product: { id: 'combo-only', name: '' }, quantity: 2, unit_price: 120,
                    price_at_purchase: 150, discount_per_unit: 30, combo_discount_per_unit: 10,
                    order_combo_id: 'sold-combo-1' },
                { product: { id: 'shared', name: '' }, quantity: 3, unit_price: 200,
                    price_at_purchase: 250, discount_per_unit: 50, order_combo_id: null },
                { product_id: 'shared', quantity: 4, unit_price: 180,
                    price_at_purchase: 250, discount_per_unit: 70, order_combo_id: 'sold-combo-2' }
            ],
            combos: [{ id: 'sold-combo-1', name: 'Bundle Offer' }],
            combo_savings: 20,
            deliveryCharge: 70,
            totalAmount: 1630,
            discountAmount: 100
        };
    });

    for (const method of ['Cash on Delivery', 'bKash']) {
        it(`snapshots named standalone and combo lines for ${method} before cart clearing`, () => {
            component.saveCashMemoData(method);
            cartItems.length = 0;
            cartCombos.length = 0;

            expect(component.orderedItems.map((item: any) => item.product.name))
                .toEqual(['Bundle product', 'Cart product', 'Cart product']);
            expect(component.orderPaymentMethod).toBe(method);
            expect(component.orderFormSnapshot).toEqual({ fullName: 'Customer' });
            expect(component.orderFormSnapshot).not.toBe(component.checkoutForm);
        });
    }

    it('matches shuffled lines by ID, preserving sold rows and all non-name fields', () => {
        const original = structuredClone(component.createdOrderObj);
        component.saveCashMemoData('Cash on Delivery');

        const expected = structuredClone(original.items);
        expected[0].product.name = 'Bundle product';
        expected[1].product.name = 'Cart product';
        expected[2].product = { name: 'Cart product' };
        expect(component.orderedItems).toEqual(expected);
        expect(component.createdOrderObj).toEqual(original);
        expect(component.orderCombos).toEqual(original.combos);
        expect(component.orderComboSavings).toBe(20);
        expect(component.orderDeliveryCharge).toBe(70);
        expect(component.orderTotal).toBe(1630);
        expect(component.orderDiscount).toBe(100);
    });

    it('preserves saved nested names, item names and product titles', () => {
        const items = [
            { product: { id: 'shared', name: 'Sold name' } },
            { product: { id: 'shared', name: '' }, name: 'Saved item name' },
            { product: { id: 'shared', name: '', title: 'Saved title' } }
        ];
        component.createdOrderObj.items = items;
        component.saveCashMemoData('Cash on Delivery');

        expect(component.orderedItems).toEqual(items);
        items.forEach((item, index) => expect(component.orderedItems[index]).toBe(item));
    });

    it('fills whitespace-only names but leaves unknown and absent IDs unchanged', () => {
        const unknown = { product: { id: 'unknown', name: '' }, quantity: 1 };
        const absent = { quantity: 2 };
        component.createdOrderObj.items = [
            { product: { id: 'shared', name: '  ' } }, unknown, absent
        ];
        component.saveCashMemoData('Cash on Delivery');

        expect(component.orderedItems[0].product.name).toBe('Cart product');
        expect(component.orderedItems[1]).toBe(unknown);
        expect(component.orderedItems[2]).toBe(absent);
    });
});
