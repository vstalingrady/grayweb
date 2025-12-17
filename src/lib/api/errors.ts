export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiNetworkError";
  }
}

export const isApiNetworkError = (value: unknown): value is ApiNetworkError =>
  value instanceof ApiNetworkError;

