
import math

def calculate_probability(numbers_to_choose, number_of_picks):
    """Calculates the probability of winning the lottery.

    Args:
        numbers_to_choose (int): The total number of numbers to choose from.
        number_of_picks (int): The number of numbers the player picks.

    Returns:
        float: The probability of winning.
    """
    # Calculate the total number of possible combinations.
    total_combinations = math.comb(numbers_to_choose, number_of_picks)

    # The probability of winning is 1 divided by the total number of combinations.
    probability = 1 / total_combinations

    return probability


if __name__ == "__main__":
    numbers_to_choose = 45  # Korean Lotto 6/45
    number_of_picks = 6

    probability = calculate_probability(numbers_to_choose, number_of_picks)

    print(f"The probability of winning the Korean Lotto 6/45 is 1 in {1/probability:.0f}")
