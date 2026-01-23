import { logger } from '../logger'
import { ApiError, AuthError, CliError, FileError, NetworkError } from './types'

/**
 * Handle errors and exit with appropriate code
 */
export function handleError(error: unknown): never {
  if (error instanceof CliError) {
    logger.error(error.message)
    process.exit(error.exitCode)
  }

  if (error instanceof Error) {
    logger.error(error.message)
    process.exit(1)
  }

  logger.error(String(error))
  process.exit(1)
}

export { ApiError, AuthError, CliError, FileError, NetworkError }
