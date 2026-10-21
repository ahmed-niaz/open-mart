import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class DiscountDomainException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'DiscountDomainException';
  }
}
