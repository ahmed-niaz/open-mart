import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class ReservationConflictException extends DomainException {
  constructor(
    public readonly orderId: string,
    public readonly currentStatus: string,
    public readonly attemptedAction: string,
  ) {
    super(
      `Cannot ${attemptedAction} reservation for order '${orderId}' because its status is already '${currentStatus}'`,
    );
  }
}
