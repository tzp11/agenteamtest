#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}
int sub(int a, int b) {
    return a -b;
}


int main() {
    printf("Add: %d\n", add(5, 3));
    printf("Add: %d\n", sub(5, 3));
    return 0;
}
// test comment
