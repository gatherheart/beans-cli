import math

def calculate_probability(total_numbers: int, numbers_drawn: int, chosen_numbers: int) -> float:
    """Calculates the probability of winning a lottery.

    Args:
        total_numbers: The total number of possible numbers.
        numbers_drawn: The number of numbers drawn.
        chosen_numbers: The number of numbers chosen by the player.

    Returns:
        The probability of winning the lottery.
    """
    total_combinations = math.comb(total_numbers, numbers_drawn)
    winning_combinations = 1
    probability = winning_combinations / total_combinations
    return probability

if __name__ == "__main__":
    total_numbers = 49
    numbers_drawn = 6
    chosen_numbers = 6

    probability = calculate_probability(total_numbers, numbers_drawn, chosen_numbers)
    print(f"The probability of winning is: {probability:.2e}")