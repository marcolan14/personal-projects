import yaml
import config


def _load_yaml(path):
    with open(path) as f:
        return yaml.safe_load(f)


def load_ips():
    return _load_yaml(config.IPS_FILE)


def load_portfolio():
    return _load_yaml(config.PORTFOLIO_FILE)["holdings"]


def load_contribution():
    return _load_yaml(config.CONTRIBUTION_FILE)["contribution"]
