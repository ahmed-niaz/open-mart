import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo.js';

export class MediaId extends UniqueId {
  constructor(id?: string) {
    super(id);
  }
}
