import { describe, expect, it } from 'vitest';
import { ShippingAddress } from '../../src/order/domain/value-objects/shipping-address.vo.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';

describe('ShippingAddress Value Object (Bangladesh)', () => {
  const validProps = {
    recipientName: 'Ariful Islam',
    recipientPhone: '01712345678',
    altPhone: '+8801812345678',
    division: 'Dhaka',
    district: 'Dhaka',
    city: 'Dhaka',
    area: 'Dhanmondi',
    addressLine: 'House 12, Road 4, Flat 3B',
    postalCode: '1205',
    country: 'BD',
  };

  it('should successfully create a valid Bangladeshi shipping address', () => {
    const address = ShippingAddress.create(validProps);

    expect(address.recipientName).toBe('Ariful Islam');
    expect(address.recipientPhone).toBe('01712345678');
    expect(address.altPhone).toBe('01812345678'); // normalized
    expect(address.division).toBe('Dhaka');
    expect(address.district).toBe('Dhaka');
    expect(address.city).toBe('Dhaka');
    expect(address.area).toBe('Dhanmondi');
    expect(address.postalCode).toBe('1205');
    expect(address.country).toBe('BD');
  });

  it('should resolve division and district aliases correctly', () => {
    const address = ShippingAddress.create({
      ...validProps,
      division: 'chittagong',
      district: "cox's bazar",
      city: "Cox's Bazar",
      area: 'Kolotoli',
      addressLine: 'Hotel Motel Zone, Road 1',
    });

    expect(address.division).toBe('Chattogram');
    expect(address.district).toBe("Cox's Bazar");
  });

  it('should throw DomainException if district does not belong to division', () => {
    expect(() =>
      ShippingAddress.create({
        ...validProps,
        division: 'Dhaka',
        district: 'Bogura', // Bogura belongs to Rajshahi
      }),
    ).toThrow(DomainException);
  });

  it('should throw DomainException if phone is not a valid BD mobile number', () => {
    expect(() =>
      ShippingAddress.create({
        ...validProps,
        recipientPhone: '123456',
      }),
    ).toThrow(DomainException);
  });

  it('should throw DomainException if recipient name is too short', () => {
    expect(() =>
      ShippingAddress.create({
        ...validProps,
        recipientName: 'A',
      }),
    ).toThrow(DomainException);
  });

  it('should produce properly formatted delivery address string', () => {
    const address = ShippingAddress.create(validProps);
    expect(address.getFormatted()).toBe(
      'House 12, Road 4, Flat 3B, Dhanmondi, Dhaka, Dhaka-1205, Dhaka, Bangladesh',
    );
  });
});
