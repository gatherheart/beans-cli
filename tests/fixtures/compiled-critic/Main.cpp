#include <algorithm>
#include <array>
#include <iostream>
#include <vector>
using Job = std::array<int, 3>;

int solve(std::vector<Job> jobs) {
    std::sort(jobs.begin(), jobs.end(), [](const Job& a, const Job& b) {
        return a[1] != b[1] ? a[1] < b[1] : a[0] < b[0];
    });
    std::vector<Job> chosen;
    for (const auto& job : jobs) {
        int conflicts = 0;
        for (const auto& old : chosen)
            if (old[0] < job[1] && job[0] < old[1]) conflicts += old[2];
        if (job[2] > conflicts) {
            chosen.erase(std::remove_if(chosen.begin(), chosen.end(), [&](const Job& old) {
                return old[0] < job[1] && job[0] < old[1];
            }), chosen.end());
            chosen.push_back(job);
        }
    }
    int result = 0;
    for (const auto& job : chosen) result += job[2];
    return result;
}

int main() {
    int cases;
    std::cin >> cases;
    while (cases--) {
        int n;
        std::cin >> n;
        std::vector<Job> jobs(n);
        for (auto& job : jobs) std::cin >> job[0] >> job[1] >> job[2];
        std::cout << solve(jobs) << '\n';
    }
}
