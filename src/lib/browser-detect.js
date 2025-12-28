/**
 * Browser detection utilities for extension
 */

/**
 * Check if running in Chrome (not Chromium-based browsers like Edge)
 * Google Tasks backend only works in Chrome due to chrome.identity API requirements
 */
export function isChrome() {
    if (typeof chrome === 'undefined') {
        return false
    }

    // Check for Chrome-specific APIs
    const hasChromeIdentity = chrome.identity && typeof chrome.identity.getAuthToken === 'function'

    // Chrome has a specific runtime structure
    const isChromeRuntime = chrome.runtime && chrome.runtime.id !== undefined

    return hasChromeIdentity && isChromeRuntime
}

/**
 * Check if running in Firefox
 */
export function isFirefox() {
    return typeof browser !== 'undefined' && browser.runtime && browser.runtime.id !== undefined
}

/**
 * Get the browser name
 */
export function getBrowserName() {
    if (isChrome()) {
        return 'chrome'
    }
    if (isFirefox()) {
        return 'firefox'
    }
    return 'unknown'
}
