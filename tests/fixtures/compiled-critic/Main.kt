import java.util.Scanner

fun solve(jobs: List<IntArray>): Int {
    val ordered = jobs.sortedWith(compareBy<IntArray> { it[1] }.thenBy { it[0] })
    val chosen = mutableListOf<IntArray>()
    for (job in ordered) {
        val conflicts = chosen.filter { it[0] < job[1] && job[0] < it[1] }.sumOf { it[2] }
        if (job[2] > conflicts) {
            chosen.removeAll { it[0] < job[1] && job[0] < it[1] }
            chosen.add(job)
        }
    }
    return chosen.sumOf { it[2] }
}

fun main() {
    val scanner = Scanner(System.`in`)
    repeat(scanner.nextInt()) {
        val jobs = List(scanner.nextInt()) {
            intArrayOf(scanner.nextInt(), scanner.nextInt(), scanner.nextInt())
        }
        println(solve(jobs))
    }
}
