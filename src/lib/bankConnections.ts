export type BankReadiness = 'draft-framework' | 'payments-only' | 'business-portal' | 'unverified'
export type BankInstitution = {
  code: string
  name: string
  readiness: BankReadiness
  readinessLabel: string
  categoryLabel: string
  note: string
}

// Public evidence only. These labels are not claims of live account-data access.
export const bankInstitutions: BankInstitution[] = [
  {code:'ubl-pk',name:'United Bank Limited (Pakistan)',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No confirmed public Pakistan personal-account aggregation API. UBL UK Open Banking is a separate market.'},
  {code:'hbl',name:'Habib Bank Limited',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No verified public third-party API for personal balance and transaction-history access found.'},
  {code:'meezan',name:'Meezan Bank',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Islamic bank',note:'No verified public customer-consented account-information API found.'},
  {code:'bank-alfalah',name:'Bank Alfalah',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No verified public personal account-information API found. Payment gateway access is not account-read access.'},
  {code:'mcb',name:'MCB Bank',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No verified public customer-consented account-information API found.'},
  {code:'allied',name:'Allied Bank',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No verified public personal balance and transaction-history API found.'},
  {code:'faysal',name:'Faysal Bank',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Commercial bank',note:'No verified public personal account-information API found.'},
  {code:'easypaisa',name:'Easypaisa',readiness:'payments-only',readinessLabel:'Partner APIs (payments)',categoryLabel:'EMI / branchless banking',note:'Publicly reported developer gateway use cases focus on merchant, bill-payment and transfer services. Personal wallet read access is not confirmed.'},
  {code:'nayapay',name:'NayaPay',readiness:'business-portal',readinessLabel:'Business portal',categoryLabel:'Electronic money institution',note:'NayaPay Business has account and transaction views in its own portal; a third-party personal-wallet read API has not been verified.'},
  {code:'jazzcash',name:'JazzCash',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'EMI / branchless banking',note:'No verified public personal-wallet account-information API found.'},
  {code:'sadapay',name:'SadaPay',readiness:'unverified',readinessLabel:'API access unverified',categoryLabel:'Electronic money institution',note:'No verified public personal account-information API found.'},
  {code:'raast-open-banking',name:'SBP Open Banking / Raast ecosystem',readiness:'draft-framework',readinessLabel:'Regulatory draft',categoryLabel:'National framework',note:'SBP draft regulations propose consent-based data sharing and payment initiation. This is not yet a live consumer connection endpoint.'}
]
