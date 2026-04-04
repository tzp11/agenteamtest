#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

// 新增函数
int subtract(int a, int b) {
    return a - b;
}

int main() {
    printf("Add: %d\n", add(5, 3));
    printf("Subtract: %d\n", subtract(5, 3));
    return 0;
}
