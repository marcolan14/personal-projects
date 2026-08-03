#!/usr/bin/env python
"""Phase 4 (first pass): assembles Phases 1-2 into the actual report format
and saves it to ~/investments-data/history/. Phase 3 (sourcing) isn't built
yet, so the Sources section is a placeholder for now.
"""

import sys
from datetime import date

import config
import data_loader
import allocation
import risk_metrics
import rebalance
import report


def main():
    cycle_label = sys.argv[1] if len(sys.argv) > 1 else "Bi-monthly check"

    ips = data_loader.load_ips()
    holdings = data_loader.load_portfolio()
    contribution = data_loader.load_contribution()

    priced = allocation.compute_holding_values_eur(holdings)
    invested_by_class, cash_buffer_eur = allocation.aggregate_by_asset_class(priced)
    total_invested, drift = allocation.compute_drift(ips, invested_by_class)

    core_holdings = [h for h in holdings if h["name"] not in config.CRYPTO_COINGECKO_IDS]
    crypto_holdings = [h for h in holdings if h["name"] in config.CRYPTO_COINGECKO_IDS]
    priced_core = [h for h in priced if h["name"] not in config.CRYPTO_COINGECKO_IDS]
    priced_crypto = [h for h in priced if h["name"] in config.CRYPTO_COINGECKO_IDS]
    total_portfolio_value = sum(h["value_eur"] for h in priced)

    core_weights = risk_metrics.compute_weights(priced_core)
    crypto_weight_of_total = sum(h["value_eur"] for h in priced_crypto) / total_portfolio_value

    print("Fetching market data (prices + history)...")
    price_matrix = risk_metrics.build_core_price_matrix(core_holdings)
    risk_result = risk_metrics.compute_risk_metrics(price_matrix, core_weights)
    crypto_summary = risk_metrics.compute_crypto_summary(crypto_holdings, crypto_weight_of_total)

    amount = (contribution["amount_min"] + contribution["amount_max"]) / 2
    target_pct = ips["target_allocation"]["asset_class"]
    class_purchases = rebalance.recommend_asset_class_purchases(invested_by_class, target_pct, amount)

    per_instrument_purchases = {}
    for ac, buy in class_purchases.items():
        holdings_in_class = [h for h in priced if h["asset_class"] == ac]
        per_instrument_purchases[ac] = rebalance.allocate_within_class(buy, holdings_in_class)

    data_caveats = [
        "BTP Valore SC OCT28 priced from a manual snapshot (portfolio.yaml price_source: manual) "
        "- not live-fetched, update by hand periodically.",
        "Crypto risk is based on 1 trailing year only (CoinGecko free-tier limit) - treat the "
        "vol/return figures as directional, not a percentile-based estimate.",
        "Sourcing (news/reports behind each recommendation) is not yet implemented - Phase 3.",
    ]

    markdown = report.render_report(
        report_date=date.today().isoformat(),
        cycle_label=cycle_label,
        total_invested=total_invested,
        cash_buffer_eur=cash_buffer_eur,
        drift=drift,
        class_purchases=class_purchases,
        per_instrument_purchases=per_instrument_purchases,
        contribution_amount=amount,
        contribution_range=(contribution["amount_min"], contribution["amount_max"]),
        risk_metrics_result=risk_result,
        crypto_summary=crypto_summary,
        gut_check=ips["risk_tolerance"]["severe_loss_gut_check"],
        sources_by_class={},
        data_caveats=data_caveats,
    )

    config.HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    out_path = config.HISTORY_DIR / f"report_{date.today().isoformat()}.md"
    out_path.write_text(markdown)
    out_path.chmod(0o600)

    print(f"Report written to {out_path}")


if __name__ == "__main__":
    main()
