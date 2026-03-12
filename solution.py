import math

prob_2_or_more = math.exp(-2/5)
prob_3_or_more = math.exp(-3/5)

prob_2_to_3 = prob_2_or_more - prob_3_or_more

conditional_prob = prob_2_to_3 / prob_2_or_more

conditional_prob_simplified = 1 - math.exp(-1/5)

print(f"P(T >= 2): {prob_2_or_more}")
print(f"P(T >= 3): {prob_3_or_more}")
print(f"P(2 <= T < 3): {prob_2_to_3}")
print(f"P(2 <= T < 3 | T >= 2): {conditional_prob}")
print(f"P(2 <= T < 3 | T >= 2) simplified: {conditional_prob_simplified}")