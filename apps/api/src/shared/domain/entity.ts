// all the other entity of our codebase are goind to go ahead  extend to this entity. Here we have some properly which i want them to inherit from this entity.

import { UniqueId } from './value-objects/unique-id.vo.js';

export abstract class Entity<T extends UniqueId = UniqueId> {
  constructor(protected readonly id: T) {}

  getId(): T {
    return this.id;
  }

  equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    return this.id.equals(other.id);
  }
}
