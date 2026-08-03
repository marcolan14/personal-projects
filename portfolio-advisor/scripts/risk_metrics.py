"""Historical risk metrics for the portfolio's "core" sleeve (everything
except crypto), using a constant-weight simulation: today's actual weights
applied to each holding's own historical return series. This naturally
captures any real stress period that falls inside the history window (e.g.
the 2020 and 2022 selloffs), without needing bespoke scenario code.

Crypto is reported separately (see compute_crypto_summary): CoinGecko's free
tier caps history at 365 days, which isn't enough independent 1-year windows
for a reliable percentile-based VaR estimate. Since crypto is a small share
of the portfolio, folding it into the main model with a single year of data
would give false precision — better to flag it qualitatively.

BTP Valore (no market data source, see portfolio.yaml price_source: manual)
is treated as a flat/zero-return series in the core sleeve — it dilutes
volatility by its real weight without overstating precision we don't have.
"""

import numpy as np
import pandas as pd

import config
import market_data

HISTORY_RANGE = "6y"


def _eur_series_for_holding(h):
    """Returns a pandas Series of EUR prices indexed by date for one
    non-crypto holding, or None if it's priced manually (flat series)."""
    if h.get("price_source") == "manual":
        return None

    symbol = h.get("yahoo_symbol") or market_data.resolve_isin_to_symbol(h["isin"])
    native_series, currency = market_data.yahoo_history(symbol, HISTORY_RANGE)

    if currency == "EUR":
        return pd.Series(native_series, name=h["name"])

    fx = market_data.fx_history(currency, "EUR", min(native_series), max(native_series))
    eur_series = {d: p * fx[d] for d, p in native_series.items() if d in fx}
    return pd.Series(eur_series, name=h["name"])


def build_core_price_matrix(core_holdings):
    """Aligned (inner-joined) daily EUR price matrix for the non-crypto
    sleeve. Holdings with price_source: manual get a flat series (zero
    daily return)."""
    series_list = []
    manual_holdings = []

    for h in core_holdings:
        s = _eur_series_for_holding(h)
        if s is None:
            manual_holdings.append(h["name"])
        else:
            s.index = pd.to_datetime(s.index)
            series_list.append(s)

    df = pd.concat(series_list, axis=1, join="inner").sort_index()

    for name in manual_holdings:
        df[name] = 1.0  # constant price -> zero return, weighted in via current value

    return df


def compute_weights(priced_holdings):
    """Weights normalized within the given set of holdings (e.g. core-only,
    or crypto-only) — not against total portfolio value."""
    total = sum(h["value_eur"] for h in priced_holdings)
    return {h["name"]: h["value_eur"] / total for h in priced_holdings}


def compute_risk_metrics(price_matrix, weights):
    returns = price_matrix.pct_change().dropna(how="any")
    weight_vector = np.array([weights[c] for c in returns.columns])

    portfolio_returns = returns.values @ weight_vector
    portfolio_returns = pd.Series(portfolio_returns, index=returns.index)

    rolling_1yr = (1 + portfolio_returns).rolling(252).apply(np.prod, raw=True) - 1
    rolling_1yr = rolling_1yr.dropna()

    var_95 = np.percentile(rolling_1yr, 5)
    cvar_95 = rolling_1yr[rolling_1yr <= var_95].mean()
    worst_1yr = rolling_1yr.min()
    worst_1yr_end_date = rolling_1yr.idxmin()
    annualized_vol = portfolio_returns.std() * np.sqrt(252)

    correlation = returns.corr()

    return {
        "history_start": returns.index.min(),
        "history_end": returns.index.max(),
        "num_1yr_windows": len(rolling_1yr),
        "annualized_vol": annualized_vol,
        "var_95": var_95,
        "cvar_95": cvar_95,
        "worst_1yr_return": worst_1yr,
        "worst_1yr_end_date": worst_1yr_end_date,
        "correlation": correlation,
    }


def compute_crypto_summary(crypto_holdings, crypto_weight_of_total):
    """Trailing 1-year annualized vol and return per coin, plus the crypto
    sleeve's combined weight of the total portfolio. Not a full historical
    VaR model — just enough context to flag the risk qualitatively."""
    per_coin = {}
    for h in crypto_holdings:
        coin_id = config.CRYPTO_COINGECKO_IDS[h["name"]]
        usd_series = market_data.coingecko_history(coin_id, days=365)
        prices = pd.Series(usd_series).sort_index()
        daily_returns = prices.pct_change().dropna()

        per_coin[h["name"]] = {
            "annualized_vol": daily_returns.std() * np.sqrt(365),
            "trailing_1yr_return": prices.iloc[-1] / prices.iloc[0] - 1,
        }

    return {
        "per_coin": per_coin,
        "crypto_weight_of_total": crypto_weight_of_total,
    }
