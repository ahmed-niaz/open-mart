import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo.js';

export class CustomerId extends UniqueId {
  static create(): CustomerId {
    return new CustomerId();
  }

  static from(id: string): CustomerId {
    return new CustomerId(id);
  }
}
