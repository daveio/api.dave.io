#!/usr/bin/env bun

/**
 * KV Admin - Backup, restore, and manage utility for Cloudflare KV storage
 *
 * This tool uses the official Cloudflare SDK to manage KV namespaces via the API.
 * For production operations, set environment variables for authentication.
 *
 * Usage:
 *   bun run bin/kv backup             - Backup KV data matching configured patterns
 *   bun run bin/kv backup --all       - Backup all KV data
 *   bun run bin/kv restore <filename> - Restore KV data from backup file
 *   bun run bin/kv wipe               - Wipe all KV data (DANGEROUS!)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import Cloudflare from "cloudflare"
import { Command } from "commander"

const BACKUP_DIR = "_backup"

// Configure the key patterns to include in the backup (using regular expressions)
const BACKUP_KEY_PATTERNS = [
  /^dashboard:demo:items$/, // Exact match for "dashboard:demo:items"
  /^redirect:.*$/, // All keys starting with "redirect:"
  /^metrics:.*$/, // All metrics keys
  /^auth:.*$/, // All auth-related keys
  /^routeros:.*$/ // All RouterOS cache keys
]

// Cloudflare configuration
const KV_NAMESPACE_ID = "184eca13ac05485d96de48c436a6f5e6" // DATA namespace from wrangler.jsonc

// Initialize Cloudflare client
function createCloudflareClient(): Cloudflare | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!apiToken || !accountId) {
    console.warn("⚠️  Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID environment variables")
    console.warn("   Using simulated data for development")
    return null
  }

  return new Cloudflare({
    apiToken
  })
}

// KV Admin Tool - requires Cloudflare credentials

const program = new Command()

program.name("kv").description("KV Admin utility for dave-io-nuxt").version("1.0.0")

// Ensure backup directory exists
function ensureBackupDirExists() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR)
    console.log(`📁 Created ${BACKUP_DIR} directory`)
  }
}

// Get current timestamp in format YYYY-MM-DD-HHmmss
function getTimestamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

// Check if a key matches any of the configured patterns
function keyMatchesPatterns(key: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(key))
}

// Fetch all keys from Cloudflare KV namespace
async function fetchAllKeys(cloudflare: Cloudflare, accountId: string): Promise<string[]> {
  const response = await cloudflare.kv.namespaces.keys.list(KV_NAMESPACE_ID, { account_id: accountId })
  return response.result?.map((key: { name: string }) => key.name) || []
}

// Fetch values for a list of keys
async function fetchKeyValues(
  cloudflare: Cloudflare,
  accountId: string,
  keys: string[]
): Promise<Record<string, unknown>> {
  const kvData: Record<string, unknown> = {}

  for (const key of keys) {
    try {
      console.log("📥 Fetching value for key:", key)
      const valueResponse = await cloudflare.kv.namespaces.values.get(KV_NAMESPACE_ID, key, { account_id: accountId })

      if (valueResponse) {
        const valueStr = await valueResponse.text()
        kvData[key] = tryParseJson(valueStr)
      }
    } catch (error) {
      console.error("❌ Failed to get value for key:", key, error)
    }
  }

  return kvData
}

// Validate Cloudflare configuration and return client details
function validateCloudflareConfig(): { cloudflare: Cloudflare; accountId: string } {
  const cloudflare = createCloudflareClient()
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!cloudflare || !accountId) {
    console.error("❌ Cloudflare credentials not configured")
    console.error("   Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables")
    process.exit(1)
  }

  return { cloudflare, accountId }
}

// Filter keys based on backup patterns
function filterKeys(allKeys: string[], backupAll: boolean): string[] {
  return backupAll ? allKeys : allKeys.filter((key: string) => keyMatchesPatterns(key, BACKUP_KEY_PATTERNS))
}

// Get all KV keys with their values, filtering by patterns if specified
async function getAllKVData(backupAll = false) {
  console.log(`📊 Fetching ${backupAll ? "all" : "selected"} keys from KV namespace...`)

  const { cloudflare, accountId } = validateCloudflareConfig()

  try {
    const allKeys = await fetchAllKeys(cloudflare, accountId)
    const keys = filterKeys(allKeys, backupAll)

    console.log(`🔍 Found ${keys.length} keys ${backupAll ? "" : `matching patterns (out of ${allKeys.length} total)`}`)

    return await fetchKeyValues(cloudflare, accountId, keys)
  } catch (error) {
    console.error("❌ Failed to fetch keys from Cloudflare KV:", error)
    throw error
  }
}

// Helper function to try parsing JSON
function tryParseJson(value: string): unknown {
  const jsonPatterns = [
    /^\{.*\}$/, // Object: {...}
    /^\[.*\]$/, // Array: [...]
    /^-?\d+(\.\d+)?$/, // Number: 123 or 123.45
    /^(true|false)$/, // Boolean: true or false
    /^null$/ // null
  ]

  const looksLikeJson = jsonPatterns.some((pattern) => pattern.test(value))

  if (looksLikeJson) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

// Backup KV data to file
async function backupKV(backupAll = false) {
  ensureBackupDirExists()
  const timestamp = getTimestamp()
  const filename = `kv-${timestamp}.json`
  const filepath = resolve(BACKUP_DIR, filename)

  try {
    console.log(`🚀 Starting KV backup (${backupAll ? "all keys" : "selected keys"})...`)
    const kvData = await getAllKVData(backupAll)

    // Write to file
    writeFileSync(filepath, JSON.stringify(kvData, null, 2))
    console.log(`✅ Backup saved to ${filepath}`)
    console.log(`📊 Backed up ${Object.keys(kvData).length} keys`)
    return true
  } catch (error) {
    console.error("❌ Failed to backup KV data:", error)
    return false
  }
}

// Restore KV data from file
async function restoreKV(filename: string) {
  try {
    const filepath = filename.startsWith("/") ? filename : resolve(BACKUP_DIR, filename)

    if (!existsSync(filepath)) {
      console.error(`❌ File not found: ${filepath}`)
      return false
    }

    console.log(`📖 Reading backup from ${filepath}...`)
    const fileData = readFileSync(filepath, "utf-8")
    const kvData = JSON.parse(fileData)

    console.log(`📊 Found ${Object.keys(kvData).length} keys to restore`)

    const cloudflare = createCloudflareClient()
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!cloudflare || !accountId) {
      console.error("❌ Cloudflare credentials not configured")
      console.error("   Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables")
      process.exit(1)
    }

    // Use Cloudflare SDK to restore data
    console.log("\n🔄 Restoring to Cloudflare KV...")
    let successCount = 0
    let errorCount = 0

    for (const [key, value] of Object.entries(kvData)) {
      try {
        const valueStr = typeof value === "string" ? value : JSON.stringify(value)
        await cloudflare.kv.namespaces.values.update(KV_NAMESPACE_ID, key, {
          account_id: accountId,
          value: valueStr,
          metadata: "{}"
        })
        const preview = valueStr.substring(0, 100) + (valueStr.length > 100 ? "..." : "")
        console.log("  ✓", `${key}:`, preview)
        successCount++
      } catch (error) {
        console.error("  ❌ Failed to restore", `${key}:`, error)
        errorCount++
      }
    }

    console.log(`\n✅ Restore completed! ${successCount} successful, ${errorCount} errors`)
    return errorCount === 0
  } catch (error) {
    console.error("❌ Failed to restore KV data:", error)
    return false
  }
}

// Wipe all KV data
async function wipeKV() {
  try {
    const cloudflare = createCloudflareClient()
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!cloudflare || !accountId) {
      console.error("❌ Cloudflare credentials not configured")
      console.error("   Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables")
      process.exit(1)
    }

    // Real KV wipe using Cloudflare SDK
    console.log("📊 Fetching all keys from Cloudflare KV...")
    const response = await cloudflare.kv.namespaces.keys.list(KV_NAMESPACE_ID, { account_id: accountId })
    const keys = response.result?.map((key: { name: string }) => key.name) || []

    console.log(`🔍 Found ${keys.length} keys to delete`)

    if (keys.length === 0) {
      console.log("✅ No keys to delete. KV namespace is already empty.")
      return true
    }

    // Multiple safety confirmations
    console.log("\n⚠️  WARNING: You are about to PERMANENTLY DELETE ALL DATA in the KV namespace.")
    console.log(`This will delete ${keys.length} keys and CANNOT be undone unless you have a backup.`)
    console.log("\n🚨 This is a DESTRUCTIVE operation!")

    // For safety, require explicit confirmation
    console.log("ℹ️  Set CONFIRM_WIPE=yes environment variable to proceed with deletion")

    if (process.env.CONFIRM_WIPE !== "yes") {
      console.log("❌ Wipe cancelled - confirmation required")
      return false
    }

    console.log("🗑️  Deleting all keys...")
    let successCount = 0
    let errorCount = 0

    for (const key of keys) {
      try {
        await cloudflare.kv.namespaces.values.delete(KV_NAMESPACE_ID, key, { account_id: accountId })
        console.log("  ✓ Deleted:", key)
        successCount++
      } catch (error) {
        console.error("  ❌ Failed to delete", `${key}:`, error)
        errorCount++
      }
    }

    console.log(`\n✅ Wipe completed! ${successCount} deleted, ${errorCount} errors`)
    return errorCount === 0
  } catch (error) {
    console.error("❌ Failed to wipe KV data:", error)
    return false
  }
}

// Backup command
program
  .command("backup")
  .description("Backup KV data to a timestamped JSON file")
  .option("-a, --all", "Backup all KV data (not just pattern matches)")
  .action(async (options) => {
    await backupKV(options.all)
  })

// Restore command
program
  .command("restore <filename>")
  .description("Restore KV data from a backup file")
  .action(async (filename) => {
    await restoreKV(filename)
  })

// Wipe command
program
  .command("wipe")
  .description("Wipe all KV data (DANGEROUS!)")
  .action(async () => {
    await wipeKV()
  })

// List command
program
  .command("list")
  .description("List all KV keys")
  .option("-p, --pattern <pattern>", "Filter keys by pattern")
  .action(async (options) => {
    try {
      console.log("📊 Listing KV keys...")

      const cloudflare = createCloudflareClient()
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

      if (!cloudflare || !accountId) {
        console.error("❌ Cloudflare credentials not configured")
        console.error("   Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables")
        process.exit(1)
      }

      // Use Cloudflare SDK to list keys
      const response = await cloudflare.kv.namespaces.keys.list(KV_NAMESPACE_ID, { account_id: accountId })
      const keys = response.result?.map((key: { name: string }) => key.name) || []

      let filteredKeys = keys
      if (options.pattern) {
        // Sanitize pattern input to prevent ReDoS attacks
        const sanitizedPattern = options.pattern
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // Escape special regex characters
          .substring(0, 100) // Limit pattern length

        try {
          // Use simple string matching instead of regex for safety
          filteredKeys = keys.filter((key: string) => key.toLowerCase().includes(sanitizedPattern.toLowerCase()))
        } catch {
          console.error("❌ Invalid pattern:", options.pattern)
          return
        }
      }

      console.log(`\n🔍 Found ${filteredKeys.length} keys${options.pattern ? ` matching "${options.pattern}"` : ""}:`)

      for (const key of filteredKeys) {
        try {
          const valueResponse = await cloudflare.kv.namespaces.values.get(KV_NAMESPACE_ID, key, {
            account_id: accountId
          })
          const value = valueResponse ? await valueResponse.text() : ""
          const preview = value.substring(0, 50) + (value.length > 50 ? "..." : "")
          console.log("  📄", `${key}:`, preview)
        } catch {
          console.log("  📄", `${key}: <failed to fetch value>`)
        }
      }
    } catch (error) {
      console.error("❌ Failed to list KV keys:", error)
    }
  })

// Add help text
program.addHelpText(
  "after",
  `
Examples:
  bun run bin/kv backup              # Backup selected data patterns
  bun run bin/kv backup --all        # Backup all KV data
  bun run bin/kv restore kv-2024-01-01-120000.json
  bun run bin/kv list                # List all keys
  bun run bin/kv list --pattern "^metrics:"  # List metrics keys
  bun run bin/kv wipe                # Wipe all data (dangerous!)

Environment Variables:
  CLOUDFLARE_API_TOKEN              - Cloudflare API token with KV permissions
  CLOUDFLARE_ACCOUNT_ID             - Your Cloudflare account ID

Note: In development, this uses simulated KV data. In production deployment,
this would connect to the actual Cloudflare KV namespace.

Backup Patterns:
  - dashboard:demo:items (demo dashboard data)
  - redirect:* (URL redirections)
  - metrics:* (API metrics)
  - auth:* (authentication data)
  - routeros:* (RouterOS cache)
`
)

async function main(): Promise<void> {
  await program.parseAsync()
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { backupKV, restoreKV, wipeKV }
