/**
 * Base CLI error class
 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message)
    this.name = 'CliError'
  }
}

/**
 * Authentication related errors
 */
export class AuthError extends CliError {
  constructor(message: string) {
    super(message, 1)
    this.name = 'AuthError'
  }
}

/**
 * Baidu API related errors
 */
export class ApiError extends CliError {
  constructor(
    message: string,
    public readonly errno?: number,
  ) {
    super(message, 1)
    this.name = 'ApiError'
  }
}

/**
 * File operation related errors
 */
export class FileError extends CliError {
  constructor(message: string) {
    super(message, 1)
    this.name = 'FileError'
  }
}

/**
 * Network related errors
 */
export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, 1)
    this.name = 'NetworkError'
  }
}
