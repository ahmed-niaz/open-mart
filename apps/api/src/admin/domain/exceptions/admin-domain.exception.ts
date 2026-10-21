import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class AdminDomainException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = AdminDomainException.name;
  }
}
