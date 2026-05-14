import { isValidIpv4, isValidPrefixLength } from './ip'
import { isValidMac } from './mac'

export type FieldValidationResult =
  | { valid: true }
  | { valid: false; message: string }

export function validateIpv4Address(ip: string): FieldValidationResult {
  return isValidIpv4(ip)
    ? { valid: true }
    : { valid: false, message: 'Invalid IP Configuration' }
}

export function validatePrefixLength(prefix: number): FieldValidationResult {
  return isValidPrefixLength(prefix)
    ? { valid: true }
    : { valid: false, message: 'Invalid IP Configuration' }
}

export function validateMacAddress(mac: string): FieldValidationResult {
  return isValidMac(mac)
    ? { valid: true }
    : { valid: false, message: 'Invalid MAC Address' }
}
