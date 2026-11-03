export type WalletProviderId = 'nayapay' | 'easypaisa'
export type WalletConnectionState = 'pending' | 'connected' | 'unavailable'

export type WalletProviderInfo = {
  id: WalletProviderId
  name: string
  connectionState: WalletConnectionState
  canReadBalance: boolean
  canReadTransactions: boolean
  note: string
}

// Personal-wallet read APIs are not verified. Keep both disabled until the
// provider gives written approval and documented read-only credentials.
export const walletProviders: WalletProviderInfo[] = [
  {
    id: 'nayapay',
    name: 'NayaPay',
    connectionState: 'pending',
    canReadBalance: false,
    canReadTransactions: false,
    note: 'Awaiting confirmation of an approved personal-wallet read API.'
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    connectionState: 'pending',
    canReadBalance: false,
    canReadTransactions: false,
    note: 'Awaiting confirmation of an approved personal-wallet read API.'
  }
]