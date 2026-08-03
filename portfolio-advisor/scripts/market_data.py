import json
from datetime import datetime, timezone
import requests
import config

HEADERS = {"User-Agent": "Mozilla/5.0"}
TIMEOUT = 10


def _load_isin_cache():
    if config.ISIN_SYMBOL_CACHE_FILE.exists():
        return json.loads(config.ISIN_SYMBOL_CACHE_FILE.read_text())
    return {}


def _save_isin_cache(cache):
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    config.ISIN_SYMBOL_CACHE_FILE.write_text(json.dumps(cache, indent=2))


def resolve_isin_to_symbol(isin):
    """ISIN -> Yahoo Finance ticker symbol, cached locally so we only hit
    the search endpoint once per instrument (venue choice doesn't change often)."""
    cache = _load_isin_cache()
    if isin in cache:
        return cache[isin]

    resp = requests.get(
        "https://query2.finance.yahoo.com/v1/finance/search",
        params={"q": isin},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    quotes = resp.json().get("quotes", [])
    if not quotes:
        raise ValueError(f"No Yahoo Finance match for ISIN {isin}")

    symbol = quotes[0]["symbol"]
    cache[isin] = symbol
    _save_isin_cache(cache)
    return symbol


def yahoo_quote(symbol):
    """Returns (price, currency) for a Yahoo Finance symbol.
    Normalizes GBp (pence, some LSE listings) to GBP so callers only ever
    see ISO 4217 codes."""
    resp = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    meta = resp.json()["chart"]["result"][0]["meta"]
    price, currency = meta["regularMarketPrice"], meta["currency"]

    if currency == "GBp":
        price, currency = price / 100, "GBP"

    return price, currency


def coingecko_prices(coin_ids, vs_currency="usd"):
    """coin_ids: list of CoinGecko ids (e.g. ['bitcoin', 'ethereum']).
    Returns {coin_id: price_in_vs_currency}."""
    resp = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": ",".join(coin_ids), "vs_currencies": vs_currency},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    return {coin_id: data[coin_id][vs_currency] for coin_id in coin_ids}


def fx_rate(base, quote):
    """1 unit of `base` expressed in `quote` currency."""
    if base == quote:
        return 1.0
    resp = requests.get(
        "https://api.frankfurter.dev/v1/latest",
        params={"base": base, "symbols": quote},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["rates"][quote]


def yahoo_history(symbol, range_="6y"):
    """Daily (date -> adjusted close) history for a Yahoo Finance symbol,
    in the symbol's native listing currency (GBp normalized to GBP/100).
    Returns (series, currency)."""
    resp = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
        params={"range": range_, "interval": "1d"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()["chart"]["result"][0]
    timestamps = result["timestamp"]
    quote = result["indicators"]["quote"][0]
    adjclose = result["indicators"].get("adjclose", [{}])[0].get("adjclose")
    closes = adjclose if adjclose else quote["close"]
    currency = result["meta"]["currency"]
    if currency == "GBp":
        currency = "GBP"
        divisor = 100
    else:
        divisor = 1

    series = {}
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        series[date] = close / divisor
    return series, currency


def coingecko_history(coin_id, days=1825, vs_currency="usd"):
    """Daily (date -> price) history for a CoinGecko coin id.
    days is capped by CoinGecko's own history depth for that coin."""
    resp = requests.get(
        f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
        params={"vs_currency": vs_currency, "days": days},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    prices = resp.json()["prices"]

    series = {}
    for ts_ms, price in prices:
        date = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        series[date] = price
    return series


def fx_history(base, quote, start_date, end_date):
    """Daily (date -> rate) history: 1 unit of `base` expressed in `quote`."""
    if base == quote:
        return {}
    resp = requests.get(
        f"https://api.frankfurter.dev/v1/{start_date}..{end_date}",
        params={"base": base, "symbols": quote},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    rates = resp.json()["rates"]
    return {date: r[quote] for date, r in rates.items()}
