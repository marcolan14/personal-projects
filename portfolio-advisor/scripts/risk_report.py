#!/usr/bin/env python
"""Phase 2 check: historical risk metrics for the whole portfolio."""

import config
import data_loader
import allocation
import risk_metrics


def main():
    ips = data_loader.load_ips()
    holdings = data_loader.load_portfolio()

    priced = allocation.compute_holding_values_eur(holdings)
    total_portfolio_value = sum(h["value_eur"] for h in priced)

    core_holdings = [h for h in holdings if h["name"] not in config.CRYPTO_COINGECKO_IDS]
    crypto_holdings = [h for h in holdings if h["name"] in config.CRYPTO_COINGECKO_IDS]
    priced_core = [h for h in priced if h["name"] not in config.CRYPTO_COINGECKO_IDS]
    priced_crypto = [h for h in priced if h["name"] in config.CRYPTO_COINGECKO_IDS]

    core_weights = risk_metrics.compute_weights(priced_core)
    crypto_weight_of_total = sum(h["value_eur"] for h in priced_crypto) / total_portfolio_value

    print("Fetching historical prices for the core (non-crypto) sleeve...")
    price_matrix = risk_metrics.build_core_price_matrix(core_holdings)
    metrics = risk_metrics.compute_risk_metrics(price_matrix, core_weights)

    gut_check = ips["risk_tolerance"]["severe_loss_gut_check"]

    print()
    print(f"Core sleeve = {1 - crypto_weight_of_total:.1%} of total portfolio value "
          f"(crypto = {crypto_weight_of_total:.1%}, reported separately below)")
    print(f"History window used: {metrics['history_start'].date()} to {metrics['history_end'].date()}")
    print(f"Overlapping 1-year windows sampled: {metrics['num_1yr_windows']}")
    print()
    print(f"Annualized volatility:        {metrics['annualized_vol']*100:>7.1f}%")
    print(f"Historical VaR 95% (1yr):     {metrics['var_95']*100:>7.1f}%")
    print(f"Historical CVaR 95% (1yr):    {metrics['cvar_95']*100:>7.1f}%")
    print(f"Worst observed 1yr return:    {metrics['worst_1yr_return']*100:>7.1f}%  "
          f"(window ending {metrics['worst_1yr_end_date'].date()})")
    print()
    print(f"Your gut-check severe-loss threshold: -{gut_check*100:.0f}%")
    if metrics["var_95"] < -gut_check:
        print("  -> Core-sleeve historical VaR95 is WORSE than your threshold.")
    else:
        print("  -> Core-sleeve historical VaR95 is within your threshold "
              f"(note: excludes the {crypto_weight_of_total:.1%} crypto sleeve).")

    print()
    print("Correlation matrix (core sleeve, daily returns):")
    print(metrics["correlation"].round(2).to_string())

    print()
    print(f"Crypto sleeve ({crypto_weight_of_total:.1%} of portfolio) - trailing 1yr only, "
          f"not enough history for a proper VaR:")
    crypto_summary = risk_metrics.compute_crypto_summary(crypto_holdings, crypto_weight_of_total)
    for name, stats in crypto_summary["per_coin"].items():
        print(f"  {name:<12} annualized vol: {stats['annualized_vol']*100:>6.1f}%   "
              f"trailing 1yr return: {stats['trailing_1yr_return']*100:>+7.1f}%")


if __name__ == "__main__":
    main()
