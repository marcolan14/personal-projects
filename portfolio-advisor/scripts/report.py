"""Renders the Markdown report. Pure formatting - no data fetching here."""


def _allocation_table(drift):
    lines = ["| Asset class | Target % | Current % | Drift (pp) | Status |",
             "|---|---|---|---|---|"]
    for d in drift:
        status = "OVER BAND" if d["over_band"] else "within band"
        lines.append(f"| {d['asset_class']} | {d['target_pct']:.1f} | "
                      f"{d['current_pct']:.1f} | {d['drift_pp']:+.1f} | {status} |")
    return "\n".join(lines)


def _recommendation_section(drift, class_purchases, per_instrument_purchases, contribution_amount,
                             contribution_range, sources_by_class):
    any_over_band = any(d["over_band"] for d in drift)
    lines = []

    if any_over_band:
        lines.append("Your allocation has drifted beyond the ±band on at least one asset class. "
                      "Recommended purchases below prioritize closing that gap first.")
    else:
        lines.append("No asset class has drifted beyond its band this cycle - no rebalancing is "
                      "triggered. For reference, here's how your planned contribution would be "
                      f"allocated if invested today (using the midpoint of your "
                      f"EUR {contribution_range[0]:,.0f}-{contribution_range[1]:,.0f} range, "
                      f"EUR {contribution_amount:,.0f}):")

    lines.append("")
    lines.append("| Asset class | Recommended buy (EUR) |")
    lines.append("|---|---|")
    for ac, amount in class_purchases.items():
        lines.append(f"| {ac} | {amount:,.2f} |")

    lines.append("")
    lines.append("**Per-instrument breakdown:**")
    lines.append("")
    lines.append("| Asset class | Instrument | Buy amount (EUR) |")
    lines.append("|---|---|---|")
    for ac, per_instrument in per_instrument_purchases.items():
        for name, amount in per_instrument.items():
            lines.append(f"| {ac} | {name} | {amount:,.2f} |")

    lines.append("")
    lines.append("**Supporting sources:**")
    lines.append("")
    for ac in class_purchases:
        srcs = sources_by_class.get(ac)
        if srcs:
            lines.append(f"- *{ac}*:")
            for s in srcs:
                lines.append(f"  - {s}")
        else:
            lines.append(f"- *{ac}*: _(sourcing not yet implemented - Phase 3)_")

    return "\n".join(lines)


def _risk_section(risk_metrics_result, crypto_summary, gut_check):
    m = risk_metrics_result
    lines = [
        f"Core sleeve (ex-crypto) historical simulation, "
        f"{m['history_start'].date()} to {m['history_end'].date()} "
        f"({m['num_1yr_windows']} overlapping 1-year windows):",
        "",
        f"- Annualized volatility: {m['annualized_vol']*100:.1f}%",
        f"- Historical VaR 95% (1yr): {m['var_95']*100:.1f}%",
        f"- Historical CVaR 95% (1yr): {m['cvar_95']*100:.1f}%",
        f"- Worst observed 1yr window: {m['worst_1yr_return']*100:.1f}% "
        f"(ending {m['worst_1yr_end_date'].date()})",
        f"- Your gut-check severe-loss threshold: -{gut_check*100:.0f}% -> "
        + ("**WORSE than threshold**" if m["var_95"] < -gut_check else "within threshold"),
        "",
        f"Crypto sleeve ({crypto_summary['crypto_weight_of_total']*100:.1f}% of portfolio) - "
        "trailing 1-year only, not enough free-tier history for a reliable VaR:",
        "",
    ]
    for name, stats in crypto_summary["per_coin"].items():
        lines.append(f"- {name}: {stats['annualized_vol']*100:.1f}% annualized vol, "
                      f"{stats['trailing_1yr_return']*100:+.1f}% trailing 1yr return")
    return "\n".join(lines)


def render_report(report_date, cycle_label, total_invested, cash_buffer_eur, drift,
                   class_purchases, per_instrument_purchases, contribution_amount, contribution_range,
                   risk_metrics_result, crypto_summary, gut_check, sources_by_class,
                   data_caveats):
    total_portfolio = total_invested + cash_buffer_eur

    parts = [
        f"# Portfolio Advisor Report - {report_date} ({cycle_label})",
        "",
        "## Summary",
        f"- Total portfolio value: EUR {total_portfolio:,.2f} "
        f"(invested sleeve EUR {total_invested:,.2f} + cash buffer EUR {cash_buffer_eur:,.2f})",
        f"- Allocation: {'drift over band on at least one class' if any(d['over_band'] for d in drift) else 'within band on all classes'}",
        f"- Risk: historical VaR95 {risk_metrics_result['var_95']*100:.1f}% vs your "
        f"-{gut_check*100:.0f}% threshold",
        "",
        "## Current Allocation vs Target",
        _allocation_table(drift),
        "",
        "## Recommended Actions",
        _recommendation_section(drift, class_purchases, per_instrument_purchases,
                                 contribution_amount, contribution_range, sources_by_class),
        "",
        "## Risk Dashboard",
        _risk_section(risk_metrics_result, crypto_summary, gut_check),
        "",
        "## Cash Buffer",
        f"- Current amount: EUR {cash_buffer_eur:,.2f}",
        "- Excluded from asset-class targets. How much (if any) to sweep into the invested "
        "sleeve is your call each January (see ips.yaml cash_buffer.annual_review).",
        "",
        "## Data Caveats",
    ]
    parts += [f"- {c}" for c in data_caveats]

    return "\n".join(parts)
