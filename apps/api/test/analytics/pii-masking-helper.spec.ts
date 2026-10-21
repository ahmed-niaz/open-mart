import { describe, expect, it } from 'vitest';
import {
  maskEmail,
  maskName,
  maskPhone,
} from '../../src/analytics/infrastructure/utils/pii-masking.helper.js';

describe('PII Masking Helper Unit Tests', () => {
  it('masks email addresses properly', () => {
    expect(maskEmail('customer@example.com')).toBe('c***r@example.com');
    expect(maskEmail('ab@domain.com')).toBe('a***@domain.com');
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
  });

  it('masks names according to privacy standards', () => {
    expect(maskName('John', 'Doe')).toBe('John D.');
    expect(maskName('Alice', '')).toBe('Alice');
    expect(maskName('', 'Smith')).toBe('Smith');
    expect(maskName(null, null)).toBe('Anonymous Customer');
  });

  it('masks phone numbers appropriately', () => {
    expect(maskPhone('+8801712345678')).toBe('+880****5678');
    expect(maskPhone('12345')).toBe('***');
    expect(maskPhone(null)).toBeNull();
  });
});
