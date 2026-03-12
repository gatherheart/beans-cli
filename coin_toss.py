
import itertools

def solve():
    # Sample space
    outcomes = list(itertools.product(['H', 'T'], repeat=3))

    # Probability of HHH
    prob_hhh = outcomes.count(('H', 'H', 'H')) / len(outcomes)

    # Probability of exactly one head
    exactly_one_head = [outcome for outcome in outcomes if outcome.count('H') == 1]
    prob_exactly_one_head = len(exactly_one_head) / len(outcomes)

    # Probability of at least one head
    at_least_one_head = [outcome for outcome in outcomes if outcome.count('H') >= 1]

    # Probability of at least two heads, given at least one head
    at_least_two_heads = [outcome for outcome in outcomes if outcome.count('H') >= 2]
    prob_at_least_two_given_at_least_one = len([outcome for outcome in at_least_two_heads if outcome in at_least_one_head]) / len(at_least_one_head)

    print(f"Probability of HHH: {prob_hhh}")
    print(f"Probability of exactly one head: {prob_exactly_one_head}")
    print(f"Probability of at least two heads given at least one head: {prob_at_least_two_given_at_least_one}")

solve()
