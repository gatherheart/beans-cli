use std::io::{self, Read};

fn solve(mut jobs: Vec<[i32; 3]>) -> i32 {
    jobs.sort_by_key(|j| (j[1], j[0]));
    let mut chosen: Vec<[i32; 3]> = Vec::new();
    for job in jobs {
        let conflicts: i32 = chosen.iter()
            .filter(|old| old[0] < job[1] && job[0] < old[1])
            .map(|old| old[2]).sum();
        if job[2] > conflicts {
            chosen.retain(|old| old[1] <= job[0] || job[1] <= old[0]);
            chosen.push(job);
        }
    }
    chosen.iter().map(|job| job[2]).sum()
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut values = input.split_whitespace().map(|s| s.parse::<i32>().unwrap());
    let cases = values.next().unwrap();
    for _ in 0..cases {
        let n = values.next().unwrap();
        let jobs = (0..n).map(|_| [values.next().unwrap(), values.next().unwrap(), values.next().unwrap()]).collect();
        println!("{}", solve(jobs));
    }
}
