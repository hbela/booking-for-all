export class AppError extends Error {
  statusCode: number;
  code: string;
  isAppError = true;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;

    // Fix for Error subclass prototype issues
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

