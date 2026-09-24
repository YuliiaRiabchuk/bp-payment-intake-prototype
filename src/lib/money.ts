/**
 * Canonical UAH money formatter (BP-372 #22). One uk-UA locale across the app
 * (Ukrainian market) — replaces the former split where warehouse used uk-UA and
 * rents used ru-RU, plus a handful of ad-hoc local copies. Integer hryvnia, ₴
 * after the amount: formatMoney(1234) === '1 234 ₴'. Currency style matches the
 * warehouse nomenclature formatters verbatim; the rents `formatCurrency` now
 * delegates here, flipping its locale ru-RU → uk-UA (visually identical for
 * integer ₴).
 */
const UAH_FORMATTER = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
})

/**
 * Мінус у сумі — типографський (U+2212), а не дефіс.
 *
 * `Intl` під uk-UA віддає U+002D, і на одному екрані виходило два різні
 * знаки для однієї речі: рядок рахунку писав «Знижка -600 грн» дефісом, а
 * книга рухів поруч — «−600 грн» мінусом, бо складала знак вручну. Дефіс
 * ще й вужчий за цифру і ламає вирівнювання в колонці з `tabular-nums`.
 */
export function formatMoney(amount: number): string {
  return UAH_FORMATTER.format(amount).replace('-', '−')
}

/** Same grouping, no currency — for a secondary «было» figure that sits
 *  directly under a `formatMoney` value which already carries the unit
 *  (BP-819: the two-line price cell in the rent form's fixed-width columns,
 *  where a repeated «грн» no longer fits). */
const AMOUNT_FORMATTER = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

export function formatAmount(amount: number): string {
  return AMOUNT_FORMATTER.format(amount)
}
