/**
 * Default operational FY: July 1 (2000 + suffix) → June 30 next calendar year.
 * Matches document pattern PREFIX-####/YY where YY is the FY start year's last two digits.
 */
export function getOperationalFiscalYearDateRange(fiscalYear: number): { start: string; end: string } {
  const startYear = 2000 + (Number(fiscalYear) % 100);
  return {
    start: `${startYear}-07-01`,
    end: `${startYear + 1}-06-30`,
  };
}

/** SQL LIKE pattern for doc numbers: %/26 */
export function fiscalYearDocLikePattern(fiscalYear: number): string {
  return `%/${String(Number(fiscalYear) % 100).padStart(2, '0')}`;
}
