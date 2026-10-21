export enum ApplicationExceptionCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
}

export class ApplicationException extends Error {
  constructor(
    message: string,
    public readonly code: ApplicationExceptionCode = ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = 'ApplicationException';
  }
}
