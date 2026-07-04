// Per-language starter / boilerplate code for coding questions.
//
// The backend stores no starter code (Question only has sample_input/output and
// test cases), so the editor seeds these stdin→stdout scaffolds locally. They
// give the candidate a runnable skeleton that already reads from standard input
// — matching how the Judge0 runner feeds test-case input.
//
// Keys must match the `value` field of LANGUAGE_OPTIONS in CodeEditor.tsx.
export const CODE_TEMPLATES: Record<string, string> = {
  python: `import sys

def solve(data):
    # TODO: implement your solution
    return ""

def main():
    data = sys.stdin.read().split()
    print(solve(data))

if __name__ == "__main__":
    main()
`,

  javascript: `// Reads all of stdin, then solve.
const input = require("fs").readFileSync(0, "utf8").trim();

function solve(input) {
  // TODO: implement your solution
  return "";
}

console.log(solve(input));
`,

  typescript: `// Reads all of stdin, then solve.
const input: string = require("fs").readFileSync(0, "utf8").trim();

function solve(input: string): string {
  // TODO: implement your solution
  return "";
}

console.log(solve(input));
`,

  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // TODO: read input and implement your solution
        StringBuilder sb = new StringBuilder();
        System.out.print(sb.toString());
    }
}
`,

  c: `#include <stdio.h>

int main(void) {
    // TODO: read input and implement your solution
    return 0;
}
`,

  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // TODO: read input and implement your solution
    return 0;
}
`,

  sql: `-- Write your SQL query below
SELECT 1;
`,
};

/** Returns the starter code for a language, or an empty string if none. */
export const getStarterCode = (language: string): string =>
  CODE_TEMPLATES[(language || "").toLowerCase()] ?? "";
