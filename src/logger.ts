import { createConsola } from 'consola'

export const logger = createConsola({
  formatOptions: {
    date: false,
  },
})

/**
 * Set logger level based on CLI options
 */
export function setLogLevel(options: { quiet?: boolean, verbose?: boolean }): void {
  if (options.quiet) {
    logger.level = 0 // Only errors
  }
  else if (options.verbose) {
    logger.level = 4 // Debug and above
  }
  else {
    logger.level = 3 // Info and above (default)
  }
}
