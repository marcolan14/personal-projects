"""Buy-only rebalancing: given new money to invest, decide how to split it
across asset classes to close drift toward IPS targets fastest, then split
each class's share across its current holdings.

No sells, ever — by design (see project README / IPS). If an asset class is
already at or above target, it gets 0 from the "close the gap" pass; any
money left over after all gaps are closed is then spread across all classes
in proportion to their targets, so a contribution larger than the total gap
still lands close to the target mix instead of piling into whichever class
happened to be most underweight.
"""


def recommend_asset_class_purchases(current_by_class_eur, target_pct, new_money):
    total_before = sum(current_by_class_eur.values())
    total_after = total_before + new_money

    gaps = {}
    for asset_class, pct in target_pct.items():
        target_eur = pct / 100 * total_after
        current_eur = current_by_class_eur.get(asset_class, 0.0)
        gaps[asset_class] = max(target_eur - current_eur, 0.0)

    total_gap = sum(gaps.values())

    if total_gap <= 0:
        # Already at/above target everywhere - just follow target weights.
        return {ac: new_money * pct / 100 for ac, pct in target_pct.items()}

    if total_gap <= new_money:
        # Enough money to close every gap, with some left over.
        leftover = new_money - total_gap
        return {
            ac: gaps[ac] + leftover * target_pct[ac] / 100
            for ac in target_pct
        }

    # Not enough money to close every gap - prioritize proportionally to gap size.
    return {ac: new_money * gaps[ac] / total_gap for ac in target_pct}


def allocate_within_class(class_amount, holdings_in_class):
    """Splits class_amount across holdings proportionally to their current
    value share within the class (maintains existing relative mix - no
    intra-class targets are defined, see ips.yaml)."""
    total = sum(h["value_eur"] for h in holdings_in_class)
    if total == 0:
        # No existing holding in this class to weight by - split evenly.
        share = class_amount / len(holdings_in_class)
        return {h["name"]: share for h in holdings_in_class}
    return {h["name"]: class_amount * h["value_eur"] / total for h in holdings_in_class}
