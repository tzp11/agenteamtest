#include <stdio.h>

void print_message(const char* msg) {
    printf("%s\n", msg);
}

int square(int n) {
    return n * n;
}

int cube(int n) {
    int sq = square(n);
    return sq * n;
}
