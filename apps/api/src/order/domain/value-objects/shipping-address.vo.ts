import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import {
  BD_DIVISION_DISTRICTS,
  BD_NAME_ALIASES,
} from './bangladesh-locations.js';

export interface ShippingAddressProps {
  recipientName: string;
  recipientPhone: string;
  altPhone?: string | null;
  division: string;
  district: string;
  city: string;
  area: string;
  addressLine: string; // house, road, block, flat, village, landmark
  postalCode?: string | null;
  country?: string; // always 'BD'
}

/** Bangladeshi mobile: 01[3-9]XXXXXXXX (11 digits). */
const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;
const BD_POSTAL_CODE_REGEX = /^\d{4}$/;

export class ShippingAddress {
  private readonly _recipientName: string;
  private readonly _recipientPhone: string;
  private readonly _altPhone: string | null;
  private readonly _division: string;
  private readonly _district: string;
  private readonly _city: string;
  private readonly _area: string;
  private readonly _addressLine: string;
  private readonly _postalCode: string | null;
  private readonly _country: string;

  private constructor(
    props: Required<Omit<ShippingAddressProps, 'altPhone' | 'postalCode'>> & {
      altPhone: string | null;
      postalCode: string | null;
    },
  ) {
    this._recipientName = props.recipientName;
    this._recipientPhone = props.recipientPhone;
    this._altPhone = props.altPhone;
    this._division = props.division;
    this._district = props.district;
    this._city = props.city;
    this._area = props.area;
    this._addressLine = props.addressLine;
    this._postalCode = props.postalCode;
    this._country = props.country;
  }

  static create(props: ShippingAddressProps): ShippingAddress {
    const recipientName = props.recipientName?.trim() ?? '';
    if (recipientName.length < 2 || recipientName.length > 100) {
      throw new DomainException(
        'Recipient name must be between 2 and 100 characters',
      );
    }

    const recipientPhone = ShippingAddress.normalizePhone(props.recipientPhone);
    if (!recipientPhone) {
      throw new DomainException(
        'Recipient phone must be a valid Bangladeshi mobile number (e.g. 01712345678)',
      );
    }

    let altPhone: string | null = null;
    if (props.altPhone && props.altPhone.trim().length > 0) {
      altPhone = ShippingAddress.normalizePhone(props.altPhone);
      if (!altPhone) {
        throw new DomainException(
          'Alternative phone must be a valid Bangladeshi mobile number',
        );
      }
    }

    const division = ShippingAddress.resolveDivision(props.division);
    const district = ShippingAddress.resolveDistrict(division, props.district);

    const city = props.city?.trim() ?? '';
    if (city.length === 0) {
      throw new DomainException('Shipping city is required');
    }

    const area = props.area?.trim() ?? '';
    if (area.length === 0) {
      throw new DomainException('Shipping area is required');
    }

    const addressLine = props.addressLine?.trim() ?? '';
    if (addressLine.length < 5) {
      throw new DomainException(
        'Address line is required (house, road, block, flat or landmark)',
      );
    }

    let postalCode: string | null = null;
    if (props.postalCode && props.postalCode.trim().length > 0) {
      postalCode = props.postalCode.trim();
      if (!BD_POSTAL_CODE_REGEX.test(postalCode)) {
        throw new DomainException('Postal code must be 4 digits when provided');
      }
    }

    const country = (props.country ?? 'BD').trim().toUpperCase();
    if (country !== 'BD') {
      throw new DomainException(
        'Only shipping within Bangladesh (BD) is supported',
      );
    }

    return new ShippingAddress({
      recipientName,
      recipientPhone,
      altPhone,
      division,
      district,
      city,
      area,
      addressLine,
      postalCode,
      country,
    });
  }

  /**
   * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX (spaces/dashes allowed).
   * Returns the normalized 11-digit form (01XXXXXXXXX) or null if invalid.
   */
  static normalizePhone(raw: string | undefined | null): string | null {
    if (!raw) return null;
    let digits = raw.replace(/[\s\-()]/g, '');
    if (digits.startsWith('+880')) digits = '0' + digits.slice(4);
    else if (digits.startsWith('880')) digits = '0' + digits.slice(3);
    return BD_MOBILE_REGEX.test(digits) ? digits : null;
  }

  private static canonical(value: string | undefined | null): string {
    const trimmed = (value ?? '').trim();
    const alias = BD_NAME_ALIASES[trimmed.toLowerCase()];
    return alias ?? trimmed;
  }

  private static resolveDivision(raw: string): string {
    const candidate = ShippingAddress.canonical(raw);
    const match = Object.keys(BD_DIVISION_DISTRICTS).find(
      (d: string) => d.toLowerCase() === candidate.toLowerCase(),
    );
    if (!match) {
      throw new DomainException(
        `Invalid division. Must be one of: ${Object.keys(BD_DIVISION_DISTRICTS).join(', ')}`,
      );
    }
    return match;
  }

  private static resolveDistrict(division: string, raw: string): string {
    const candidate = ShippingAddress.canonical(raw);
    const districts = BD_DIVISION_DISTRICTS[division];
    if (!districts) {
      throw new DomainException(`Invalid division: ${division}`);
    }
    const match = districts.find(
      (d: string) => d.toLowerCase() === candidate.toLowerCase(),
    );
    if (!match) {
      throw new DomainException(
        `District "${raw}" does not belong to ${division} division`,
      );
    }
    return match;
  }

  get recipientName(): string {
    return this._recipientName;
  }

  get recipientPhone(): string {
    return this._recipientPhone;
  }

  get altPhone(): string | null {
    return this._altPhone;
  }

  get division(): string {
    return this._division;
  }

  get district(): string {
    return this._district;
  }

  get city(): string {
    return this._city;
  }

  get area(): string {
    return this._area;
  }

  get addressLine(): string {
    return this._addressLine;
  }

  get postalCode(): string | null {
    return this._postalCode;
  }

  get country(): string {
    return this._country;
  }

  equals(other: ShippingAddress): boolean {
    return JSON.stringify(this.toObject()) === JSON.stringify(other.toObject());
  }

  toObject(): ShippingAddressProps {
    return {
      recipientName: this._recipientName,
      recipientPhone: this._recipientPhone,
      altPhone: this._altPhone,
      division: this._division,
      district: this._district,
      city: this._city,
      area: this._area,
      addressLine: this._addressLine,
      postalCode: this._postalCode,
      country: this._country,
    };
  }

  getFormatted(): string {
    const postal = this._postalCode ? `-${this._postalCode}` : '';
    return `${this._addressLine}, ${this._area}, ${this._city}, ${this._district}${postal}, ${this._division}, Bangladesh`;
  }
}
