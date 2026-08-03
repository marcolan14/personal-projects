#!/usr/bin/env python
"""Phase 2 check: buy-only purchase recommendations for this year's
contribution. The cash buffer is NOT auto-included - how much of it (if any)
to sweep alongside the contribution is your call each January (see ips.yaml
cash_buffer.annual_review); this just shows what the contribution alone
would look like, so you can re-run it with a larger amount if you decide to
sweep some of the buffer too.
"""

import config
import data_loader
import allocation
import rebalance


def main():
    ips = data_loader.load_ips()
    holdings = data_loader.load_portfolio()
    contribution = data_loader.load_contribution()

    priced = allocation.compute_holding_values_eur(holdings)
    invested_by_class, cash_buffer_eur = allocation.aggregate_by_asset_class(priced)
    target_pct = ips["target_allocation"]["asset_class"]

    amount = (contribution["amount_min"] + contribution["amount_max"]) / 2
    print(f"Using contribution midpoint: EUR {amount:,.2f} "
          f"(range EUR {contribution['amount_min']:,.0f}-{contribution['amount_max']:,.0f})")
    print(f"Cash buffer (EUR {cash_buffer_eur:,.2f}) excluded - sweep decision is yours, see note above.")
    print()

    class_purchases = rebalance.recommend_asset_class_purchases(invested_by_class, target_pct, amount)

    print(f"{'Asset class':<20}{'Buy amount':>14}")
    for ac, buy in class_purchases.items():
        print(f"{ac:<20}{buy:>14,.2f}")

    print()
    print("Per-instrument breakdown:")
    for ac, buy in class_purchases.items():
        holdings_in_class = [h for h in priced if h["asset_class"] == ac]
        per_instrument = rebalance.allocate_within_class(buy, holdings_in_class)
        for name, instrument_amount in per_instrument.items():
            print(f"  [{ac}] {name:<55}EUR {instrument_amount:>10,.2f}")

    print()
    total_after = sum(invested_by_class.values()) + amount
    print("Projected allocation after this contribution:")
    for ac in target_pct:
        projected_eur = invested_by_class.get(ac, 0.0) + class_purchases[ac]
        projected_pct = projected_eur / total_after * 100
        print(f"  {ac:<20}{projected_pct:>6.1f}%  (target {target_pct[ac]:.1f}%)")


if __name__ == "__main__":
    main()
