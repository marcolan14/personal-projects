#!/usr/bin/env python
"""Phase 1 pipeline check: loads real holdings, fetches live prices,
computes current allocation vs IPS targets. No research/report yet (Phase 4)."""

import data_loader
import allocation


def main():
    ips = data_loader.load_ips()
    holdings = data_loader.load_portfolio()

    priced = allocation.compute_holding_values_eur(holdings)
    invested_by_class, cash_buffer_eur = allocation.aggregate_by_asset_class(priced)
    total_invested, drift = allocation.compute_drift(ips, invested_by_class)

    print(f"Invested sleeve total: EUR {total_invested:,.2f}")
    print(f"Cash buffer (excluded from targets): EUR {cash_buffer_eur:,.2f}")
    print()
    print(f"{'Asset class':<20}{'Target %':>10}{'Current %':>12}{'Drift (pp)':>12}{'Flag':>8}")
    for d in drift:
        flag = "OVER BAND" if d["over_band"] else ""
        print(f"{d['asset_class']:<20}{d['target_pct']:>10.1f}{d['current_pct']:>12.1f}"
              f"{d['drift_pp']:>+12.1f}{flag:>12}")

    print()
    print("Per-holding detail:")
    for h in priced:
        symbol = h.get("_symbol", "-")
        note = " [STALE SNAPSHOT - update manually]" if h.get("_stale_price") else ""
        print(f"  {h['name']:<55}{h['asset_class']:<20}EUR {h['value_eur']:>12,.2f}  ({symbol}){note}")


if __name__ == "__main__":
    main()
