import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("PORTFOLIO_DATA_DIR", str(Path.home() / "investments-data")))
CACHE_DIR = DATA_DIR / "cache"
HISTORY_DIR = DATA_DIR / "history"

IPS_FILE = DATA_DIR / "ips.yaml"
PORTFOLIO_FILE = DATA_DIR / "portfolio.yaml"
CONTRIBUTION_FILE = DATA_DIR / "contribution.yaml"
ISIN_SYMBOL_CACHE_FILE = CACHE_DIR / "isin_symbol_map.json"

CRYPTO_COINGECKO_IDS = {
    "Bitcoin": "bitcoin",
    "Ethereum": "ethereum",
    "Solana": "solana",
}
