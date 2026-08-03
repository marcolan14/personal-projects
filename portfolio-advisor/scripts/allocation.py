import config
import market_data


def compute_holding_values_eur(holdings):
    """Returns holdings with a `value_eur` field added, using live prices."""
    priced = []

    crypto_holdings = [h for h in holdings if h["name"] in config.CRYPTO_COINGECKO_IDS]
    if crypto_holdings:
        coin_ids = [config.CRYPTO_COINGECKO_IDS[h["name"]] for h in crypto_holdings]
        usd_prices = market_data.coingecko_prices(coin_ids, vs_currency="usd")
        usd_to_eur = market_data.fx_rate("USD", "EUR")
    else:
        usd_prices, usd_to_eur = {}, None

    for h in holdings:
        h = dict(h)
        if h["name"] in config.CRYPTO_COINGECKO_IDS:
            coin_id = config.CRYPTO_COINGECKO_IDS[h["name"]]
            value_usd = h["quantity"] * usd_prices[coin_id]
            h["value_eur"] = value_usd * usd_to_eur
        elif h.get("price_source") == "manual":
            h["value_eur"] = h["value_snapshot"]
            h["_stale_price"] = True
        else:
            symbol = h.get("yahoo_symbol") or market_data.resolve_isin_to_symbol(h["isin"])
            price, currency = market_data.yahoo_quote(symbol)
            value_native = h["quantity"] * price
            rate = market_data.fx_rate(currency, "EUR")
            h["value_eur"] = value_native * rate
            h["_symbol"] = symbol
            h["_price"] = price
            h["_price_currency"] = currency
        priced.append(h)

    return priced


def aggregate_by_asset_class(priced_holdings):
    """Splits into the invested sleeve (stocks/bonds/alternative_assets) and
    the cash_buffer, which sits outside the target_allocation entirely."""
    invested = {}
    cash_buffer_eur = 0.0

    for h in priced_holdings:
        if h["asset_class"] == "cash_buffer":
            cash_buffer_eur += h["value_eur"]
        else:
            invested[h["asset_class"]] = invested.get(h["asset_class"], 0.0) + h["value_eur"]

    return invested, cash_buffer_eur


def compute_drift(ips, invested_by_class):
    total = sum(invested_by_class.values())
    targets = ips["target_allocation"]["asset_class"]
    band = ips["rebalancing"]["band_pp"]

    drift = []
    for asset_class, target_pct in targets.items():
        current_eur = invested_by_class.get(asset_class, 0.0)
        current_pct = (current_eur / total * 100) if total else 0.0
        drift_pp = current_pct - target_pct
        drift.append({
            "asset_class": asset_class,
            "target_pct": target_pct,
            "current_pct": current_pct,
            "current_eur": current_eur,
            "drift_pp": drift_pp,
            "over_band": abs(drift_pp) > band,
        })
    return total, drift
