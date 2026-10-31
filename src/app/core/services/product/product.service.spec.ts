import { ProductService } from './product.service';
import { ApiService } from '../api/api.service';
import { ProductImage } from '../../../models/product.model';

describe('ProductService image mapping', () => {
  const service = new ProductService({} as ApiService, 'browser');
  const image = (id: string, is_primary = false): ProductImage => ({
    id, product_id: '1', is_primary,
    image_path: `${id}.jpg`,
    image_thumb: `${id}-thumb.jpg`,
    image_medium: `${id}-medium.jpg`,
    image_large: `${id}-large.jpg`
  });

  it('puts the primary image first in both gallery and thumbnail order without mutating input', () => {
    const images = [image('first'), image('primary', true), image('last')];
    const original = images.map(img => ({ ...img }));
    images.forEach(Object.freeze);
    Object.freeze(images);

    const product = service.mapBackendToFrontend({ images });
    expect(product.imageObjects).not.toBe(images);
    expect(product.imageObjects!.map(img => img.id)).toEqual(['primary', 'first', 'last']);
    expect(product.imageUrl).toBe(service.getImageUrl('primary-medium.jpg'));
    expect(product.images).toEqual(['primary', 'first', 'last'].map(id => service.getImageUrl(`${id}-large.jpg`)));
    const thumbnails = product.imageObjects!.map(img => service.getImageUrl(
      img.image_thumb || img.image_medium || img.image_large || img.image_path
    ));
    expect(thumbnails.map((thumbnail, index) => [thumbnail, product.images![index]])).toEqual(
      ['primary', 'first', 'last'].map(id => [
        service.getImageUrl(`${id}-thumb.jpg`), service.getImageUrl(`${id}-large.jpg`)
      ])
    );
    expect(images).toEqual(original);
  });

  it('preserves backend order when no image is primary', () => {
    const images = [image('first'), image('second'), image('third')];
    const product = service.mapBackendToFrontend({ images });
    expect(product.imageObjects).toEqual(images);
    expect(product.images).toEqual(images.map(img => service.getImageUrl(img.image_large)));
    expect(product.imageUrl).toBe(service.getImageUrl('first-medium.jpg'));
  });

  it('preserves variant URL fallbacks for gallery images and thumbnails', () => {
    const images = [
      { ...image('medium'), image_large: '' },
      { ...image('thumb'), image_large: '', image_medium: '' },
      { ...image('path'), image_large: '', image_medium: '', image_thumb: '' },
      { ...image('large', true), image_medium: '', image_thumb: '' }
    ];
    const product = service.mapBackendToFrontend({ images });
    expect(product.imageUrl).toBe(service.getImageUrl('large-large.jpg'));
    expect(product.images).toEqual([
      'large-large.jpg', 'medium-medium.jpg', 'thumb-thumb.jpg', 'path.jpg'
    ].map(url => service.getImageUrl(url)));
    expect(product.imageObjects!.map(img => service.getImageUrl(
      img.image_thumb || img.image_medium || img.image_large || img.image_path
    ))).toEqual([
      'large-large.jpg', 'medium-thumb.jpg', 'thumb-thumb.jpg', 'path.jpg'
    ].map(url => service.getImageUrl(url)));
  });

  it('preserves legacy and missing-image URL fallbacks', () => {
    const legacy = service.mapBackendToFrontend({ image: 'legacy.jpg' });
    expect(legacy.imageUrl).toBe(service.getImageUrl('legacy.jpg'));
    expect(legacy.images).toEqual([legacy.imageUrl]);
    expect(legacy.imageObjects).toEqual([]);
    expect(service.mapBackendToFrontend({ primary_image_url: 'primary.jpg' }).imageUrl)
      .toBe(service.getImageUrl('primary.jpg'));
    expect(service.mapBackendToFrontend({ imageUrl: 'card.jpg' }).imageUrl)
      .toBe(service.getImageUrl('card.jpg'));
    expect(service.mapBackendToFrontend({}).imageUrl).toBe(service.getImageUrl(undefined));
  });
});
