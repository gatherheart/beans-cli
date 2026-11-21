import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Scanner;

public class Main {
    static int solve(List<int[]> jobs) {
        jobs.sort(Comparator.<int[]>comparingInt(j -> j[1]).thenComparingInt(j -> j[0]));
        List<int[]> chosen = new ArrayList<>();
        for (int[] job : jobs) {
            int conflicts = 0;
            for (int[] old : chosen) {
                if (old[0] < job[1] && job[0] < old[1]) conflicts += old[2];
            }
            if (job[2] > conflicts) {
                chosen.removeIf(old -> old[0] < job[1] && job[0] < old[1]);
                chosen.add(job);
            }
        }
        return chosen.stream().mapToInt(j -> j[2]).sum();
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int cases = scanner.nextInt();
        for (int c = 0; c < cases; c++) {
            int n = scanner.nextInt();
            List<int[]> jobs = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                jobs.add(new int[]{scanner.nextInt(), scanner.nextInt(), scanner.nextInt()});
            }
            System.out.println(solve(jobs));
        }
    }
}
