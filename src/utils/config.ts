import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { logger } from '../logger'

const CONFIG_DIR = path.join(os.homedir(), '.baidupan-cli')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export interface Config {
  access_token?: string
  refresh_token?: string
  app_key?: string
  secret_key?: string
  expires_at?: number // timestamp
}

/**
 * Load config from file
 */
export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(content)
    }
  }
  catch {
    // ignore
  }
  return {}
}

/**
 * Save config to file
 */
export function saveConfig(config: Config): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
  }
  catch (error) {
    logger.warn('配置保存失败:', error instanceof Error ? error.message : error)
  }
}

/**
 * Update config (merge with existing)
 */
export function updateConfig(updates: Partial<Config>): void {
  const config = loadConfig()
  Object.assign(config, updates)
  saveConfig(config)
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return CONFIG_FILE
}
